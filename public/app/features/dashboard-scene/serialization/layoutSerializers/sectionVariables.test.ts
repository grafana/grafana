import { ConstantVariable, CustomVariable, SceneVariableSet } from '@grafana/scenes';
import {
  type ConstantVariableKind,
  type CustomVariableKind,
  type VariableKind,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { deserializeSectionVariables, serializeSectionVariables } from './sectionVariables';

const makeVariableSet = (...variables: Array<CustomVariable | ConstantVariable>) => new SceneVariableSet({ variables });

const makeCustomVariable = (overrides: Partial<ConstructorParameters<typeof CustomVariable>[0]> = {}) =>
  new CustomVariable({
    name: 'env',
    label: 'Environment',
    query: 'dev,staging,prod',
    ...overrides,
  });

const makeConstantVariable = (overrides: Partial<ConstructorParameters<typeof ConstantVariable>[0]> = {}) =>
  new ConstantVariable({
    name: 'version',
    label: 'Version',
    value: '1.0.0',
    ...overrides,
  });

const makeCustomVariableKind = (overrides: Partial<CustomVariableKind['spec']> = {}): CustomVariableKind => ({
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
    ...overrides,
  },
});

const makeConstantVariableKind = (overrides: Partial<ConstantVariableKind['spec']> = {}): ConstantVariableKind => ({
  kind: 'ConstantVariable',
  spec: {
    name: 'version',
    label: 'Version',
    query: '1.0.0',
    current: { text: '1.0.0', value: '1.0.0' },
    hide: 'dontHide',
    skipUrlSync: false,
    ...overrides,
  },
});

beforeEach(() => {
  setTestFlags({ dashboardSectionVariables: true });
});

afterEach(() => {
  setTestFlags({});
});

describe('serializeSectionVariables', () => {
  it.each([
    ['undefined input', undefined],
    ['empty SceneVariableSet', makeVariableSet()],
  ])('should return undefined for %s', (_, input) => {
    expect(serializeSectionVariables(input)).toBeUndefined();
  });

  it('should serialize a single CustomVariable', () => {
    const set = makeVariableSet(makeCustomVariable({ description: 'Target environment' }));

    const result = serializeSectionVariables(set);

    expect(result).toHaveLength(1);
    expect(result![0].kind).toBe('CustomVariable');
    expect((result![0] as CustomVariableKind).spec.name).toBe('env');
    expect((result![0] as CustomVariableKind).spec.query).toBe('dev,staging,prod');
  });

  it('should serialize multiple variables', () => {
    const set = makeVariableSet(makeCustomVariable(), makeConstantVariable());

    const result = serializeSectionVariables(set);

    expect(result).toHaveLength(2);
    expect(result![0].kind).toBe('CustomVariable');
    expect(result![1].kind).toBe('ConstantVariable');
  });
});

describe('createSectionVariables', () => {
  it.each([
    ['undefined input', undefined],
    ['empty array', []],
  ])('should return undefined for %s', (_, input) => {
    expect(deserializeSectionVariables(input)).toBeUndefined();
  });

  it('should create a SceneVariableSet from a single CustomVariableKind', () => {
    const variables: VariableKind[] = [makeCustomVariableKind({ description: 'Target environment' })];

    const result = deserializeSectionVariables(variables);

    expect(result).toBeDefined();
    expect(result!.state.variables).toHaveLength(1);
    expect(result!.state.variables[0].state.name).toBe('env');
  });

  it('should create a SceneVariableSet with multiple variables', () => {
    const variables: VariableKind[] = [makeCustomVariableKind(), makeConstantVariableKind()];

    const result = deserializeSectionVariables(variables);

    expect(result).toBeDefined();
    expect(result!.state.variables).toHaveLength(2);
    expect(result!.state.variables[0].state.name).toBe('env');
    expect(result!.state.variables[1].state.name).toBe('version');
  });
});

describe('round-trip: serialize → deserialize', () => {
  it('should preserve CustomVariable properties through a round trip', () => {
    const original = makeVariableSet(
      makeCustomVariable({
        description: 'Target environment',
        value: 'dev',
        text: 'dev',
        includeAll: true,
        isMulti: true,
      })
    );

    const serialized = serializeSectionVariables(original);
    expect(serialized).toBeDefined();

    const deserialized = deserializeSectionVariables(serialized);
    expect(deserialized).toBeDefined();

    const variable = deserialized!.state.variables[0];
    expect(variable.state.name).toBe('env');
    expect(variable.state.label).toBe('Environment');
    expect(variable.state.description).toBe('Target environment');
    expect((variable as CustomVariable).state.query).toBe('dev,staging,prod');
  });

  it('should preserve multiple variables through a round trip', () => {
    const original = makeVariableSet(
      makeCustomVariable(),
      makeConstantVariable({ description: 'App version', value: '2.0.0' })
    );

    const serialized = serializeSectionVariables(original);
    expect(serialized).toBeDefined();
    expect(serialized).toHaveLength(2);

    const deserialized = deserializeSectionVariables(serialized);
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
