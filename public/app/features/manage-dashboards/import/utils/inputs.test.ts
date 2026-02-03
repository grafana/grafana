import { DataSourceInstanceSettings } from '@grafana/data';
import {
  AnnotationQueryKind,
  PanelKind,
  QueryVariableKind,
  Spec as DashboardV2Spec,
} from '@grafana/schema/dist/esm/schema/dashboard/v2';
import { Dashboard, Panel, VariableModel } from '@grafana/schema/dist/esm/veneer/dashboard.types';
import { ExportFormat } from 'app/features/dashboard/api/types';

import { DashboardInputs, ImportDashboardDTO, ImportFormDataV2, InputType } from '../../types';

import {
  applyV1Inputs,
  applyV2Inputs,
  detectExportFormat,
  extractV1Inputs,
  extractV2Inputs,
  isVariableRef,
  replaceDatasourcesInDashboard,
  DatasourceMappings,
} from './inputs';

// Mock external dependencies
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    getList: jest.fn().mockReturnValue([{ uid: 'ds-1', name: 'Prometheus', type: 'prometheus' }]),
  }),
}));

jest.mock('../../../library-panels/state/api', () => ({
  getLibraryPanel: jest.fn().mockRejectedValue({ status: 404 }),
}));

// Test data constants
const emptyInputs: DashboardInputs = { dataSources: [], constants: [], libraryPanels: [] };

const sampleV1Inputs: DashboardInputs = {
  dataSources: [
    {
      name: 'DS',
      label: 'DS',
      description: 'test',
      info: 'info',
      value: '',
      type: InputType.DataSource,
      pluginId: 'prometheus',
    },
  ],
  constants: [],
  libraryPanels: [],
};

// Helper functions for creating test data
function createV1DashboardWithInputs(
  inputs: Array<{
    name: string;
    type: InputType;
    label: string;
    description?: string;
    pluginId?: string;
    value?: string;
  }>
) {
  return {
    title: 'Test Dashboard',
    __inputs: inputs,
  };
}

describe('detectExportFormat', () => {
  it.each([
    ['v2 resource', { kind: 'DashboardWithAccessInfo', spec: { elements: {} } }, ExportFormat.V2Resource],
    ['v2 spec (raw)', { elements: {}, layout: {} }, ExportFormat.V2Resource],
    ['v1 resource', { kind: 'DashboardWithAccessInfo', spec: { title: 'v1' } }, ExportFormat.V1Resource],
    ['classic', { title: 'v1' }, ExportFormat.Classic],
  ])('detects %s format', (_name, dashboard, expected) => {
    expect(detectExportFormat(dashboard)).toBe(expected);
  });
});

// Test helper types for accessing nested properties
interface PanelWithTargets extends Panel {
  targets?: Array<{ datasource?: { uid?: string } }>;
}

interface QueryVariableModel extends VariableModel {
  datasource?: { uid?: string };
}

interface DatasourceVariableModel {
  type: string;
  current?: { value?: string; text?: string; selected?: boolean };
}

// Removed duplicate constants - now defined at top of file

describe('extractV1Inputs', () => {
  it.each([
    ['non-object dashboard', null],
    ['dashboard without __inputs', { title: 'Test Dashboard' }],
  ])('should return empty inputs for %s', async (_name, dashboard) => {
    const result = await extractV1Inputs(dashboard);
    expect(result).toEqual(emptyInputs);
  });

  it('should extract datasource inputs from __inputs array', async () => {
    const dashboard = createV1DashboardWithInputs([
      {
        name: 'DS_PROMETHEUS',
        type: InputType.DataSource,
        label: 'Prometheus',
        description: 'Prometheus datasource',
        pluginId: 'prometheus',
      },
    ]);

    const result = await extractV1Inputs(dashboard);

    expect(result.dataSources).toHaveLength(1);
    expect(result.dataSources[0].name).toBe('DS_PROMETHEUS');
    expect(result.dataSources[0].pluginId).toBe('prometheus');
    expect(result.dataSources[0].type).toBe(InputType.DataSource);
  });

  it('should extract constant inputs from __inputs array', async () => {
    const dashboard = createV1DashboardWithInputs([
      {
        name: 'VAR_CONSTANT',
        type: InputType.Constant,
        label: 'My Constant',
        description: 'A constant value',
        value: 'default-value',
      },
    ]);

    const result = await extractV1Inputs(dashboard);

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

    const result = await extractV1Inputs(dashboard);

    expect(result.constants[0].info).toBe('Specify a string constant');
  });

  it('should extract multiple inputs of different types', async () => {
    const dashboard = createV1DashboardWithInputs([
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
    ]);

    const result = await extractV1Inputs(dashboard);

    expect(result.dataSources).toHaveLength(2);
    expect(result.constants).toHaveLength(1);
  });

  it('should skip invalid inputs and only process valid ones', async () => {
    const dashboard = {
      title: 'Test Dashboard',
      __inputs: [null, 'invalid', { name: 'VALID', type: InputType.Constant, label: 'Valid', value: 'test' }],
    };

    const result = await extractV1Inputs(dashboard);

    expect(result.constants).toHaveLength(1);
    expect(result.constants[0].name).toBe('VALID');
  });

  it('should skip inputs without a type', async () => {
    const dashboard = {
      title: 'Test Dashboard',
      __inputs: [{ name: 'MISSING_TYPE' }],
    };

    const result = await extractV1Inputs(dashboard);
    expect(result.dataSources).toHaveLength(0);
    expect(result.constants).toHaveLength(0);
  });

  it('should handle empty __inputs array', async () => {
    const dashboard = { title: 'Test Dashboard', __inputs: [] };
    const result = await extractV1Inputs(dashboard);
    expect(result).toEqual(emptyInputs);
  });
});

describe('extractV2Inputs', () => {
  it('should return empty inputs for non-object dashboard', () => {
    expect(extractV2Inputs(null)).toEqual(emptyInputs);
  });

  it.each([
    [
      'query variables',
      {
        elements: {},
        variables: [
          {
            kind: 'QueryVariable',
            spec: { name: 'myvar', query: { group: 'prometheus', labels: { exportLabel: 'prom-1' } } },
          },
        ],
      },
    ],
    [
      'annotations',
      {
        elements: {},
        annotations: [
          {
            kind: 'AnnotationQuery',
            spec: { name: 'Deployments', query: { group: 'prometheus', labels: { exportLabel: 'prom-1' } } },
          },
        ],
      },
    ],
    [
      'panel queries',
      {
        elements: {
          'panel-1': {
            kind: 'Panel',
            spec: {
              data: {
                kind: 'QueryGroup',
                spec: {
                  queries: [
                    { kind: 'PanelQuery', spec: { query: { group: 'prometheus', labels: { exportLabel: 'prom-1' } } } },
                  ],
                },
              },
            },
          },
        },
      },
    ],
  ])('should collect datasource types from %s', (_source, dashboard) => {
    const result = extractV2Inputs(dashboard);
    expect(result.dataSources).toHaveLength(1);
    expect(result.dataSources[0].pluginId).toBe('prometheus');
  });

  it('should handle empty dashboard gracefully', () => {
    const result = extractV2Inputs({});
    expect(result).toEqual(emptyInputs);
  });

  it('should keep distinct datasource labels', () => {
    const dashboard = {
      elements: {},
      variables: [
        {
          kind: 'QueryVariable',
          spec: { name: 'var1', query: { group: 'prometheus', labels: { exportLabel: 'prom-1' } } },
        },
        {
          kind: 'QueryVariable',
          spec: { name: 'var2', query: { group: 'prometheus', labels: { exportLabel: 'prom-2' } } },
        },
      ],
      annotations: [
        { spec: { name: 'Deployments', query: { group: 'prometheus', labels: { exportLabel: 'prom-3' } } } },
      ],
    };

    const result = extractV2Inputs(dashboard);

    expect(result.dataSources).toHaveLength(3);
    expect(result.dataSources.map((ds) => ds.name)).toEqual(['prom-1', 'prom-2', 'prom-3']);
    expect(result.dataSources.map((ds) => ds.pluginId)).toEqual(['prometheus', 'prometheus', 'prometheus']);
  });

  it('should collect multiple different datasource types', () => {
    const dashboard = {
      elements: {},
      variables: [
        {
          kind: 'QueryVariable',
          spec: { name: 'promvar', query: { group: 'prometheus', labels: { exportLabel: 'prom-1' } } },
        },
        {
          kind: 'QueryVariable',
          spec: { name: 'lokivar', query: { group: 'loki', labels: { exportLabel: 'loki-1' } } },
        },
      ],
    };

    const result = extractV2Inputs(dashboard);

    expect(result.dataSources).toHaveLength(2);
    expect(result.dataSources.map((ds) => ds.pluginId)).toContain('prometheus');
    expect(result.dataSources.map((ds) => ds.pluginId)).toContain('loki');
  });

  it.each([
    [
      'non-QueryVariable variables',
      { variables: [{ kind: 'TextVariable', spec: { name: 'textvar', value: 'test' } }] },
    ],
    [
      'panels without QueryGroup data',
      { elements: { 'panel-1': { kind: 'Panel', spec: { data: { kind: 'Snapshot', spec: {} } } } } },
    ],
  ])('should skip %s', (_name, dashboard) => {
    expect(extractV2Inputs(dashboard).dataSources).toHaveLength(0);
  });
});

describe('applyV1Inputs', () => {
  it('replaces templateized datasources across v1 dashboard elements', () => {
    const dashboard = {
      title: 'old',
      uid: 'old',
      schemaVersion: 39,
      annotations: {
        list: [
          {
            name: 'anno',
            datasource: { uid: '${DS}' },
            enable: true,
            iconColor: 'red',
            target: { limit: 1, matchAny: true, tags: [], type: 'tags' },
          },
        ],
      },
      panels: [
        {
          datasource: { uid: '${DS}' },
          targets: [{ datasource: { uid: '${DS}' } }],
        },
      ],
      templating: {
        list: [
          {
            type: 'query',
            datasource: { uid: '${DS}' },
          },
          {
            type: 'datasource',
            current: { value: '${DS}', text: '${DS}', selected: true },
          },
        ],
      },
    } as unknown as Dashboard;

    const form: ImportDashboardDTO = {
      title: 'new-title',
      uid: 'new-uid',
      gnetId: '',
      constants: [],
      dataSources: [{ uid: 'ds-uid', type: 'prometheus', name: 'My DS' } as DataSourceInstanceSettings],
      elements: [],
      folder: { uid: 'folder' },
    };

    const result = applyV1Inputs(dashboard, sampleV1Inputs, form);

    expect(result.title).toBe('new-title');
    expect(result.uid).toBe('new-uid');
    expect(result.annotations?.list?.[0].datasource?.uid).toBe('ds-uid');
    expect(result.panels?.[0].datasource?.uid).toBe('ds-uid');

    const panelWithTargets = result.panels?.[0] as PanelWithTargets;
    expect(panelWithTargets.targets?.[0].datasource?.uid).toBe('ds-uid');

    const queryVariable = result.templating?.list?.[0] as QueryVariableModel;
    expect(queryVariable.datasource?.uid).toBe('ds-uid');

    const dsVariable = result.templating?.list?.[1] as DatasourceVariableModel;
    expect(dsVariable.current?.value).toBe('ds-uid');
  });
});

describe('applyV2Inputs', () => {
  it('updates v2 annotations, variables, and panel queries', () => {
    const dashboard = {
      title: 'old',
      elements: {
        panel: {
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
                        group: 'prometheus',
                        labels: { exportLabel: 'prometheus-1' },
                        datasource: { name: 'old-ds' },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      },
      annotations: [
        {
          kind: 'AnnotationQuery',
          spec: {
            query: {
              group: 'prometheus',
              labels: { exportLabel: 'prometheus-1' },
              datasource: { name: 'old-ds' },
            },
          },
        },
      ],
      variables: [
        {
          kind: 'QueryVariable',
          spec: {
            query: {
              group: 'prometheus',
              labels: { exportLabel: 'prometheus-1' },
              datasource: { name: 'old-ds' },
            },
          },
        },
      ],
    } as unknown as DashboardV2Spec;

    const form: ImportFormDataV2 = {
      dashboard,
      folderUid: 'folder',
      message: '',
      'datasource-prometheus-1': { uid: 'ds-uid', type: 'prometheus', name: 'My DS' },
    };

    const result = applyV2Inputs(dashboard, form);

    const updatedAnnotation = result.annotations?.[0] as AnnotationQueryKind;
    expect(updatedAnnotation.spec.query?.datasource?.name).toBe('ds-uid');

    const updatedVariable = result.variables?.[0] as QueryVariableKind;
    expect(updatedVariable.spec.query?.datasource?.name).toBe('ds-uid');

    const updatedPanel = result.elements.panel as PanelKind;
    const queries = updatedPanel.spec.data?.kind === 'QueryGroup' ? updatedPanel.spec.data.spec.queries : [];
    const updatedQuery = queries[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const querySpec = updatedQuery?.spec as any;
    expect(querySpec?.query?.datasource?.name).toBe('ds-uid');
  });

  it('uses datasource labels to keep selections independent', () => {
    const dashboard = {
      title: 'old',
      elements: {
        panel: {
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
                        group: 'prometheus',
                        labels: { exportLabel: 'prometheus-1' },
                        datasource: { name: 'old-ds' },
                      },
                    },
                  },
                  {
                    kind: 'PanelQuery',
                    spec: {
                      query: {
                        group: 'prometheus',
                        labels: { exportLabel: 'prometheus-2' },
                        datasource: { name: 'old-ds' },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      },
      annotations: [],
      variables: [],
    } as unknown as DashboardV2Spec;

    const form: ImportFormDataV2 = {
      dashboard,
      folderUid: 'folder',
      message: '',
      'datasource-prometheus-1': { uid: 'ds-uid-1', type: 'prometheus', name: 'Prometheus 1' },
      'datasource-prometheus-2': { uid: 'ds-uid-2', type: 'prometheus', name: 'Prometheus 2' },
    };

    const result = applyV2Inputs(dashboard, form);

    const updatedPanel = result.elements.panel as PanelKind;
    const queries = updatedPanel.spec.data?.kind === 'QueryGroup' ? updatedPanel.spec.data.spec.queries : [];
    const firstQuery = queries[0];
    const secondQuery = queries[1];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const firstSpec = firstQuery?.spec as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const secondSpec = secondQuery?.spec as any;
    expect(firstSpec?.query?.datasource?.name).toBe('ds-uid-1');
    expect(secondSpec?.query?.datasource?.name).toBe('ds-uid-2');
  });

  it('preserves variable references and does not replace them', () => {
    const dashboard = {
      title: 'old',
      elements: {},
      annotations: [
        {
          kind: 'AnnotationQuery',
          spec: {
            query: {
              group: 'prometheus',
              labels: { exportLabel: 'prometheus-1' },
              datasource: { name: '${ds}' },
            },
          },
        },
      ],
      variables: [],
    } as unknown as DashboardV2Spec;

    const form: ImportFormDataV2 = {
      dashboard,
      folderUid: 'folder',
      message: '',
      'datasource-prometheus-1': { uid: 'ds-uid', type: 'prometheus', name: 'My DS' },
    };

    const result = applyV2Inputs(dashboard, form);

    const annotation = result.annotations?.[0] as AnnotationQueryKind;
    expect(annotation.spec.query?.datasource?.name).toBe('${ds}');
  });
});

describe('isVariableRef', () => {
  it.each([
    { input: '${ds}', expected: true },
    { input: '$ds', expected: true },
    { input: 'abc123', expected: false },
    { input: undefined, expected: false },
    { input: '', expected: false },
  ])('returns $expected for $input', ({ input, expected }) => {
    expect(isVariableRef(input)).toBe(expected);
  });
});

describe('replaceDatasourcesInDashboard', () => {
  // @ts-ignore - using minimal test schema
  const baseDashboard: DashboardV2Spec = {
    title: 'Test Dashboard',
    annotations: [],
    variables: [],
    elements: {},
    layout: { kind: 'GridLayout', spec: { items: [] } },
    cursorSync: 'Off',
    liveNow: false,
    editable: true,
    preload: false,
    links: [],
    tags: [],
    timeSettings: {
      timezone: 'utc',
      from: 'now-6h',
      to: 'now',
      autoRefresh: '',
      autoRefreshIntervals: [],
      hideTimepicker: false,
      fiscalYearStartMonth: 0,
    },
  };

  const mappings: DatasourceMappings = {
    loki: { uid: 'new-loki-uid', type: 'loki', name: 'New Loki' },
    prometheus: { uid: 'new-prom-uid', type: 'prometheus', name: 'New Prometheus' },
  };

  const createPanelWithQuery = (group: string, datasourceName: string) => ({
    kind: 'Panel' as const,
    spec: {
      id: 1,
      title: 'Test Panel',
      description: '',
      links: [],
      vizConfig: {
        kind: 'VizConfig' as const,
        group: 'timeseries',
        version: 'v0',
        spec: { options: {}, fieldConfig: { defaults: {}, overrides: [] } },
      },
      data: {
        kind: 'QueryGroup' as const,
        spec: {
          queries: [
            {
              kind: 'PanelQuery' as const,
              spec: {
                refId: 'A',
                hidden: false,
                query: {
                  kind: 'DataQuery' as const,
                  group,
                  version: 'v0',
                  datasource: { name: datasourceName },
                  spec: {},
                },
              },
            },
          ],
          queryOptions: {},
          transformations: [],
        },
      },
    },
  });

  const getPanelQueryDatasourceName = (result: DashboardV2Spec, panelKey = 'panel-1') => {
    const panel = result.elements[panelKey];
    if (panel.kind === 'Panel' && panel.spec.data?.kind === 'QueryGroup') {
      return panel.spec.data.spec.queries[0].spec.query?.datasource?.name;
    }
    return undefined;
  };

  const getQueryVariable = (result: DashboardV2Spec, index = 0) => {
    const variable = result.variables?.[index];
    return variable?.kind === 'QueryVariable' ? variable : undefined;
  };

  const getDatasourceVariable = (result: DashboardV2Spec, index = 0) => {
    const variable = result.variables?.[index];
    return variable?.kind === 'DatasourceVariable' ? variable : undefined;
  };

  const getAdhocVariable = (result: DashboardV2Spec, index = 0) => {
    const variable = result.variables?.[index];
    return variable?.kind === 'AdhocVariable' ? variable : undefined;
  };

  const getGroupByVariable = (result: DashboardV2Spec, index = 0) => {
    const variable = result.variables?.[index];
    return variable?.kind === 'GroupByVariable' ? variable : undefined;
  };

  describe('panel queries', () => {
    it.each([
      { group: 'loki', inputDs: 'old-loki-uid', expectedDs: 'new-loki-uid', desc: 'replaces hardcoded datasource' },
      { group: 'prometheus', inputDs: '${ds}', expectedDs: '${ds}', desc: 'preserves ${ds} variable reference' },
      { group: 'prometheus', inputDs: '$ds', expectedDs: '$ds', desc: 'preserves $ds variable reference' },
      {
        group: 'elasticsearch',
        inputDs: 'es-uid',
        expectedDs: 'es-uid',
        desc: 'keeps original when no mapping exists',
      },
    ])('$desc', ({ group, inputDs, expectedDs }) => {
      // @ts-ignore - using minimal test schema
      const dashboard: DashboardV2Spec = {
        ...baseDashboard,
        elements: { 'panel-1': createPanelWithQuery(group, inputDs) },
      };

      const result = replaceDatasourcesInDashboard(dashboard, mappings);

      expect(getPanelQueryDatasourceName(result)).toBe(expectedDs);
    });
  });

  describe('annotations', () => {
    const createAnnotation = (group: string, datasourceName: string) => ({
      kind: 'AnnotationQuery' as const,
      spec: {
        name: 'Test Annotation',
        enable: true,
        hide: false,
        iconColor: 'red',
        query: {
          kind: 'DataQuery' as const,
          group,
          version: 'v0',
          datasource: { name: datasourceName },
          spec: {},
        },
      },
    });

    it.each([
      { inputDs: 'old-prom-uid', expectedDs: 'new-prom-uid', desc: 'replaces hardcoded datasource' },
      { inputDs: '${ds}', expectedDs: '${ds}', desc: 'preserves variable reference' },
    ])('$desc', ({ inputDs, expectedDs }) => {
      // @ts-ignore - using minimal test schema
      const dashboard: DashboardV2Spec = {
        ...baseDashboard,
        annotations: [createAnnotation('prometheus', inputDs)],
      };

      const result = replaceDatasourcesInDashboard(dashboard, mappings);

      expect(result.annotations?.[0].spec.query?.datasource?.name).toBe(expectedDs);
    });
  });

  describe('query variable', () => {
    const createQueryVariable = (group: string, datasourceName: string) => ({
      kind: 'QueryVariable' as const,
      spec: {
        name: 'test_var',
        current: { text: 'All', value: '$__all' },
        options: [{ text: 'All', value: '$__all' }],
        hide: 'dontHide' as const,
        skipUrlSync: false,
        multi: false,
        includeAll: true,
        allowCustomValue: false,
        refresh: 'onDashboardLoad' as const,
        regex: '',
        sort: 'disabled' as const,
        query: {
          kind: 'DataQuery' as const,
          group,
          version: 'v0',
          datasource: { name: datasourceName },
          spec: {},
        },
      },
    });

    it('replaces hardcoded datasource and resets options/current', () => {
      // @ts-ignore - using minimal test schema
      const dashboard: DashboardV2Spec = {
        ...baseDashboard,
        variables: [createQueryVariable('prometheus', 'old-prom-uid')],
      };

      const result = replaceDatasourcesInDashboard(dashboard, mappings);
      const variable = getQueryVariable(result);

      expect(variable).toBeDefined();
      expect(variable?.spec.query?.datasource?.name).toBe('new-prom-uid');
      expect(variable?.spec.options).toEqual([]);
      expect(variable?.spec.current).toEqual({ text: '', value: '' });
      expect(variable?.spec.refresh).toBe('onDashboardLoad');
    });

    it('preserves variable reference and keeps options intact', () => {
      // @ts-ignore - using minimal test schema
      const dashboard: DashboardV2Spec = {
        ...baseDashboard,
        variables: [createQueryVariable('prometheus', '${ds}')],
      };

      const result = replaceDatasourcesInDashboard(dashboard, mappings);
      const variable = getQueryVariable(result);

      expect(variable?.spec.query?.datasource?.name).toBe('${ds}');
      expect(variable?.spec.options).toEqual([{ text: 'All', value: '$__all' }]);
    });
  });

  describe('datasource variable', () => {
    const createDatasourceVariable = (pluginId: string, currentValue: string, currentText: string) => ({
      kind: 'DatasourceVariable' as const,
      spec: {
        name: 'ds',
        pluginId,
        current: { text: currentText, value: currentValue },
        options: [],
        hide: 'dontHide' as const,
        skipUrlSync: false,
        multi: false,
        includeAll: false,
        allowCustomValue: false,
        refresh: 'onDashboardLoad' as const,
        regex: '',
      },
    });

    it('replaces current value in DatasourceVariable', () => {
      // @ts-ignore - using minimal test schema
      const dashboard: DashboardV2Spec = {
        ...baseDashboard,
        variables: [createDatasourceVariable('prometheus', 'old-prom-uid', 'Old Prometheus')],
      };

      const result = replaceDatasourcesInDashboard(dashboard, mappings);
      const variable = getDatasourceVariable(result);

      expect(variable).toBeDefined();
      expect(variable?.spec.current?.value).toBe('new-prom-uid');
      expect(variable?.spec.current?.text).toBe('New Prometheus');
    });
  });

  describe('AdhocVariable', () => {
    const createAdhocVariable = (group: string, datasourceName: string) => ({
      kind: 'AdhocVariable' as const,
      group,
      datasource: { name: datasourceName },
      spec: {
        name: 'Filters',
        hide: 'dontHide' as const,
        skipUrlSync: false,
        allowCustomValue: true,
        defaultKeys: [],
        filters: [],
        baseFilters: [],
      },
    });

    it.each([
      { inputDs: 'old-loki-uid', expectedDs: 'new-loki-uid', desc: 'replaces hardcoded datasource' },
      { inputDs: '${ds}', expectedDs: '${ds}', desc: 'preserves variable reference' },
    ])('$desc', ({ inputDs, expectedDs }) => {
      // @ts-ignore - using minimal test schema
      const dashboard: DashboardV2Spec = {
        ...baseDashboard,
        variables: [createAdhocVariable('loki', inputDs)],
      };

      const result = replaceDatasourcesInDashboard(dashboard, mappings);
      const variable = getAdhocVariable(result);

      expect(variable).toBeDefined();
      expect(variable?.datasource?.name).toBe(expectedDs);
    });
  });

  describe('GroupBy variable', () => {
    const createGroupByVariable = (group: string, datasourceName: string) => ({
      kind: 'GroupByVariable' as const,
      group,
      datasource: { name: datasourceName },
      spec: {
        name: 'groupby',
        hide: 'dontHide' as const,
        skipUrlSync: false,
        allowCustomValue: false,
        multi: false,
        options: [],
        current: { text: '', value: '' },
      },
    });

    it.each([
      { inputDs: 'old-prom-uid', expectedDs: 'new-prom-uid', desc: 'replaces hardcoded datasource' },
      { inputDs: '${ds}', expectedDs: '${ds}', desc: 'preserves variable reference' },
    ])('$desc', ({ inputDs, expectedDs }) => {
      // @ts-ignore - using minimal test schema
      const dashboard: DashboardV2Spec = {
        ...baseDashboard,
        variables: [createGroupByVariable('prometheus', inputDs)],
      };

      const result = replaceDatasourcesInDashboard(dashboard, mappings);
      const variable = getGroupByVariable(result);

      expect(variable).toBeDefined();
      expect(variable?.datasource?.name).toBe(expectedDs);
    });
  });

  describe('edge cases', () => {
    it('handles mixed variable and hardcoded datasources', () => {
      // @ts-ignore - using minimal test schema
      const dashboard: DashboardV2Spec = {
        ...baseDashboard,
        elements: {
          'panel-variable': createPanelWithQuery('prometheus', '${ds}'),
          'panel-hardcoded': createPanelWithQuery('loki', 'old-loki-uid'),
        },
      };

      const result = replaceDatasourcesInDashboard(dashboard, mappings);

      expect(getPanelQueryDatasourceName(result, 'panel-variable')).toBe('${ds}');
      expect(getPanelQueryDatasourceName(result, 'panel-hardcoded')).toBe('new-loki-uid');
    });
  });
});
