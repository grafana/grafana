import { InputType } from '../state/reducers';

import { processInputsFromDashboard, processV2Inputs } from './process';

// Mock getDataSourceSrv
jest.mock('@grafana/runtime', () => ({
  getDataSourceSrv: () => ({
    getList: jest.fn().mockReturnValue([{ uid: 'ds-1', name: 'Prometheus', type: 'prometheus' }]),
  }),
}));

// Mock getLibraryPanel
jest.mock('../../library-panels/state/api', () => ({
  getLibraryPanel: jest.fn().mockRejectedValue(new Error('Not found')),
}));

describe('processInputsFromDashboard', () => {
  it('should return empty inputs for non-object dashboard', async () => {
    const result = await processInputsFromDashboard(null);

    expect(result).toEqual({
      dataSources: [],
      constants: [],
      libraryPanels: [],
    });
  });

  it('should return empty inputs for dashboard without __inputs', async () => {
    const result = await processInputsFromDashboard({ title: 'Test Dashboard' });

    expect(result).toEqual({
      dataSources: [],
      constants: [],
      libraryPanels: [],
    });
  });

  it('should process datasource inputs', async () => {
    const dashboard = {
      title: 'Test Dashboard',
      __inputs: [
        {
          name: 'DS_PROMETHEUS',
          type: InputType.DataSource,
          label: 'Prometheus',
          description: 'Prometheus datasource',
          pluginId: 'prometheus',
        },
      ],
    };

    const result = await processInputsFromDashboard(dashboard);

    expect(result.dataSources).toHaveLength(1);
    expect(result.dataSources[0].name).toBe('DS_PROMETHEUS');
    expect(result.dataSources[0].pluginId).toBe('prometheus');
    expect(result.dataSources[0].type).toBe(InputType.DataSource);
  });

  it('should process constant inputs', async () => {
    const dashboard = {
      title: 'Test Dashboard',
      __inputs: [
        {
          name: 'VAR_CONSTANT',
          type: InputType.Constant,
          label: 'My Constant',
          description: 'A constant value',
          value: 'default-value',
        },
      ],
    };

    const result = await processInputsFromDashboard(dashboard);

    expect(result.constants).toHaveLength(1);
    expect(result.constants[0].name).toBe('VAR_CONSTANT');
    expect(result.constants[0].value).toBe('default-value');
    expect(result.constants[0].type).toBe(InputType.Constant);
  });

  it('should add default info for constants without description', async () => {
    const dashboard = {
      title: 'Test Dashboard',
      __inputs: [
        {
          name: 'VAR_CONSTANT',
          type: InputType.Constant,
          label: 'My Constant',
          value: '',
        },
      ],
    };

    const result = await processInputsFromDashboard(dashboard);

    expect(result.constants[0].info).toBe('Specify a string constant');
  });

  it('should process multiple inputs of different types', async () => {
    const dashboard = {
      title: 'Test Dashboard',
      __inputs: [
        {
          name: 'DS_PROMETHEUS',
          type: InputType.DataSource,
          label: 'Prometheus',
          pluginId: 'prometheus',
        },
        {
          name: 'DS_LOKI',
          type: InputType.DataSource,
          label: 'Loki',
          pluginId: 'loki',
        },
        {
          name: 'VAR_NAMESPACE',
          type: InputType.Constant,
          label: 'Namespace',
          value: 'default',
        },
      ],
    };

    const result = await processInputsFromDashboard(dashboard);

    expect(result.dataSources).toHaveLength(2);
    expect(result.constants).toHaveLength(1);
  });

  it('should skip invalid inputs', async () => {
    const dashboard = {
      title: 'Test Dashboard',
      __inputs: [null, 'invalid', { name: 'VALID', type: InputType.Constant, label: 'Valid', value: 'test' }],
    };

    const result = await processInputsFromDashboard(dashboard);

    expect(result.constants).toHaveLength(1);
    expect(result.constants[0].name).toBe('VALID');
  });
});

describe('processV2Inputs', () => {
  it('should return empty inputs for non-object dashboard', () => {
    const result = processV2Inputs(null);

    expect(result).toEqual({
      dataSources: [],
      constants: [],
      libraryPanels: [],
    });
  });

  it('should collect datasource types from query variables', () => {
    const dashboard = {
      variables: [
        {
          kind: 'QueryVariable',
          spec: {
            name: 'myvar',
            query: {
              spec: {
                group: 'prometheus',
              },
            },
          },
        },
      ],
    };

    const result = processV2Inputs(dashboard);

    expect(result.dataSources).toHaveLength(1);
    expect(result.dataSources[0].pluginId).toBe('prometheus');
  });

  it('should collect datasource types from annotations', () => {
    const dashboard = {
      annotations: [
        {
          kind: 'AnnotationQuery',
          spec: {
            name: 'Deployments',
            query: {
              spec: {
                group: 'prometheus',
              },
            },
          },
        },
      ],
    };

    const result = processV2Inputs(dashboard);

    expect(result.dataSources).toHaveLength(1);
    expect(result.dataSources[0].pluginId).toBe('prometheus');
  });

  it('should collect datasource types from panel queries', () => {
    const dashboard = {
      elements: {
        'panel-1': {
          kind: 'Panel',
          spec: {
            data: {
              kind: 'QueryGroup',
              spec: {
                queries: [
                  {
                    kind: 'PanelQuery',
                    spec: {
                      query: {
                        kind: 'prometheus',
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      },
    };

    const result = processV2Inputs(dashboard);

    expect(result.dataSources).toHaveLength(1);
    expect(result.dataSources[0].pluginId).toBe('prometheus');
  });

  it('should deduplicate datasource types', () => {
    const dashboard = {
      variables: [
        {
          kind: 'QueryVariable',
          spec: {
            name: 'var1',
            query: { spec: { group: 'prometheus' } },
          },
        },
        {
          kind: 'QueryVariable',
          spec: {
            name: 'var2',
            query: { spec: { group: 'prometheus' } },
          },
        },
      ],
      annotations: [
        {
          spec: {
            name: 'Deployments',
            query: { spec: { group: 'prometheus' } },
          },
        },
      ],
    };

    const result = processV2Inputs(dashboard);

    expect(result.dataSources).toHaveLength(1);
    expect(result.dataSources[0].pluginId).toBe('prometheus');
  });

  it('should collect multiple different datasource types', () => {
    const dashboard = {
      variables: [
        {
          kind: 'QueryVariable',
          spec: {
            name: 'promvar',
            query: { spec: { group: 'prometheus' } },
          },
        },
        {
          kind: 'QueryVariable',
          spec: {
            name: 'lokivar',
            query: { spec: { group: 'loki' } },
          },
        },
      ],
    };

    const result = processV2Inputs(dashboard);

    expect(result.dataSources).toHaveLength(2);
    expect(result.dataSources.map((ds) => ds.pluginId)).toContain('prometheus');
    expect(result.dataSources.map((ds) => ds.pluginId)).toContain('loki');
  });

  it('should skip non-QueryVariable variables', () => {
    const dashboard = {
      variables: [
        {
          kind: 'TextVariable',
          spec: {
            name: 'textvar',
            value: 'test',
          },
        },
      ],
    };

    const result = processV2Inputs(dashboard);

    expect(result.dataSources).toHaveLength(0);
  });

  it('should skip panels without QueryGroup data', () => {
    const dashboard = {
      elements: {
        'panel-1': {
          kind: 'Panel',
          spec: {
            data: {
              kind: 'Snapshot',
              spec: {},
            },
          },
        },
      },
    };

    const result = processV2Inputs(dashboard);

    expect(result.dataSources).toHaveLength(0);
  });
});
