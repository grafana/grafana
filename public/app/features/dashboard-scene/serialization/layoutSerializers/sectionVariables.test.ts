import { ConstantVariable, CustomVariable, SceneVariableSet } from '@grafana/scenes';
import { CustomVariableKind, VariableKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { createSectionVariables, serializeSectionVariables } from './sectionVariables';

describe('serializeSectionVariables', () => {
  it('should return undefined when called with undefined', () => {
    expect(serializeSectionVariables(undefined)).toBeUndefined();
  });

  it('should return undefined for an empty SceneVariableSet', () => {
    const set = new SceneVariableSet({ variables: [] });
    expect(serializeSectionVariables(set)).toBeUndefined();
  });

  it('should serialize a single CustomVariable', () => {
    const set = new SceneVariableSet({
      variables: [
        new CustomVariable({
          name: 'env',
          label: 'Environment',
          description: 'Target environment',
          query: 'dev,staging,prod',
        }),
      ],
    });

    const result = serializeSectionVariables(set);

    expect(result).toHaveLength(1);
    expect(result![0].kind).toBe('CustomVariable');
    expect((result![0] as CustomVariableKind).spec.name).toBe('env');
    expect((result![0] as CustomVariableKind).spec.query).toBe('dev,staging,prod');
  });

  it('should serialize multiple variables', () => {
    const set = new SceneVariableSet({
      variables: [
        new CustomVariable({
          name: 'env',
          label: 'Environment',
          query: 'dev,staging,prod',
        }),
        new ConstantVariable({
          name: 'version',
          label: 'Version',
          value: '1.0.0',
        }),
      ],
    });

    const result = serializeSectionVariables(set);

    expect(result).toHaveLength(2);
    expect(result![0].kind).toBe('CustomVariable');
    expect(result![1].kind).toBe('ConstantVariable');
  });
});

describe('createSectionVariables', () => {
  it('should return undefined when called with undefined', () => {
    expect(createSectionVariables(undefined)).toBeUndefined();
  });

  it('should return undefined for an empty array', () => {
    expect(createSectionVariables([])).toBeUndefined();
  });

  it('should create a SceneVariableSet from a single CustomVariableKind', () => {
    const variables: VariableKind[] = [
      {
        kind: 'CustomVariable',
        spec: {
          name: 'env',
          label: 'Environment',
          description: 'Target environment',
          query: 'dev,staging,prod',
          current: { text: 'dev', value: 'dev' },
          options: [],
          multi: false,
          includeAll: false,
          hide: 'dontHide',
          skipUrlSync: false,
          allowCustomValue: true,
        },
      },
    ];

    const result = createSectionVariables(variables);

    expect(result).toBeDefined();
    expect(result!.state.variables).toHaveLength(1);
    expect(result!.state.variables[0].state.name).toBe('env');
  });

  it('should create a SceneVariableSet with multiple variables', () => {
    const variables: VariableKind[] = [
      {
        kind: 'CustomVariable',
        spec: {
          name: 'env',
          label: 'Environment',
          query: 'dev,staging,prod',
          current: { text: 'dev', value: 'dev' },
          options: [],
          multi: false,
          includeAll: false,
          hide: 'dontHide',
          skipUrlSync: false,
          allowCustomValue: true,
        },
      },
      {
        kind: 'ConstantVariable',
        spec: {
          name: 'version',
          label: 'Version',
          query: '1.0.0',
          current: { text: '1.0.0', value: '1.0.0' },
          hide: 'dontHide',
          skipUrlSync: false,
        },
      },
    ];

    const result = createSectionVariables(variables);

    expect(result).toBeDefined();
    expect(result!.state.variables).toHaveLength(2);
    expect(result!.state.variables[0].state.name).toBe('env');
    expect(result!.state.variables[1].state.name).toBe('version');
  });
});

describe('round-trip: serialize → deserialize', () => {
  it('should preserve CustomVariable properties through a round trip', () => {
    const original = new SceneVariableSet({
      variables: [
        new CustomVariable({
          name: 'env',
          label: 'Environment',
          description: 'Target environment',
          query: 'dev,staging,prod',
          value: 'dev',
          text: 'dev',
          includeAll: true,
          isMulti: true,
        }),
      ],
    });

    const serialized = serializeSectionVariables(original);
    expect(serialized).toBeDefined();

    const deserialized = createSectionVariables(serialized);
    expect(deserialized).toBeDefined();

    const variable = deserialized!.state.variables[0];
    expect(variable.state.name).toBe('env');
    expect(variable.state.label).toBe('Environment');
    expect(variable.state.description).toBe('Target environment');
    expect((variable as CustomVariable).state.query).toBe('dev,staging,prod');
  });

  it('should preserve multiple variables through a round trip', () => {
    const original = new SceneVariableSet({
      variables: [
        new CustomVariable({
          name: 'env',
          label: 'Environment',
          query: 'dev,staging,prod',
        }),
        new ConstantVariable({
          name: 'version',
          label: 'Version',
          description: 'App version',
          value: '2.0.0',
        }),
      ],
    });

    const serialized = serializeSectionVariables(original);
    expect(serialized).toBeDefined();
    expect(serialized).toHaveLength(2);

    const deserialized = createSectionVariables(serialized);
    expect(deserialized).toBeDefined();
    expect(deserialized!.state.variables).toHaveLength(2);

    const customVar = deserialized!.state.variables[0];
    expect(customVar.state.name).toBe('env');
    expect(customVar.state.label).toBe('Environment');

    const constantVar = deserialized!.state.variables[1];
    expect(constantVar.state.name).toBe('version');
    expect(constantVar.state.label).toBe('Version');
    expect(constantVar.state.description).toBe('App version');
    expect((constantVar as ConstantVariable).state.value).toBe('2.0.0');
  });
});
