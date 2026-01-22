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

import { applyV1Inputs, applyV2Inputs, detectExportFormat, extractV1Inputs, extractV2Inputs } from './inputs';

// Mock getDataSourceSrv
jest.mock('@grafana/runtime', () => ({
  getDataSourceSrv: () => ({
    getList: jest.fn().mockReturnValue([{ uid: 'ds-1', name: 'Prometheus', type: 'prometheus' }]),
  }),
}));

// Mock getLibraryPanel from library-panels/state/api
jest.mock('../../../library-panels/state/api', () => ({
  getLibraryPanel: jest.fn().mockRejectedValue({ status: 404 }),
}));

describe('detectExportFormat', () => {
  it('detects v2 resource format', () => {
    const dashboard = { kind: 'DashboardWithAccessInfo', spec: { elements: {} } };
    expect(detectExportFormat(dashboard)).toBe(ExportFormat.V2Resource);
  });

  it('detects v2 spec format (raw)', () => {
    const dashboard = { elements: {}, layout: {} };
    expect(detectExportFormat(dashboard)).toBe(ExportFormat.V2Resource);
  });

  it('detects v1 resource format', () => {
    const dashboard = { kind: 'DashboardWithAccessInfo', spec: { title: 'v1' } };
    expect(detectExportFormat(dashboard)).toBe(ExportFormat.V1Resource);
  });

  it('detects classic format', () => {
    const dashboard = { title: 'v1' };
    expect(detectExportFormat(dashboard)).toBe(ExportFormat.Classic);
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

const makeV1Inputs = (): DashboardInputs => ({
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
});

describe('extractV1Inputs', () => {
  it('should return empty inputs for non-object dashboard', async () => {
    const result = await extractV1Inputs(null);

    expect(result).toEqual({
      dataSources: [],
      constants: [],
      libraryPanels: [],
    });
  });

  it('should return empty inputs for dashboard without __inputs', async () => {
    const result = await extractV1Inputs({ title: 'Test Dashboard' });

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

    const result = await extractV1Inputs(dashboard);

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

    const result = await extractV1Inputs(dashboard);

    expect(result.dataSources).toHaveLength(2);
    expect(result.constants).toHaveLength(1);
  });

  it('should skip invalid inputs', async () => {
    const dashboard = {
      title: 'Test Dashboard',
      __inputs: [null, 'invalid', { name: 'VALID', type: InputType.Constant, label: 'Valid', value: 'test' }],
    };

    const result = await extractV1Inputs(dashboard);

    expect(result.constants).toHaveLength(1);
    expect(result.constants[0].name).toBe('VALID');
  });
});

describe('extractV2Inputs', () => {
  it('should return empty inputs for non-object dashboard', () => {
    const result = extractV2Inputs(null);

    expect(result).toEqual({
      dataSources: [],
      constants: [],
      libraryPanels: [],
    });
  });

  it('should collect datasource types from query variables', () => {
    const dashboard = {
      elements: {},
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

    const result = extractV2Inputs(dashboard);

    expect(result.dataSources).toHaveLength(1);
    expect(result.dataSources[0].pluginId).toBe('prometheus');
  });

  it('should collect datasource types from annotations', () => {
    const dashboard = {
      elements: {},
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

    const result = extractV2Inputs(dashboard);

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

    const result = extractV2Inputs(dashboard);

    expect(result.dataSources).toHaveLength(1);
    expect(result.dataSources[0].pluginId).toBe('prometheus');
  });

  it('should deduplicate datasource types', () => {
    const dashboard = {
      elements: {},
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

    const result = extractV2Inputs(dashboard);

    expect(result.dataSources).toHaveLength(1);
    expect(result.dataSources[0].pluginId).toBe('prometheus');
  });

  it('should collect multiple different datasource types', () => {
    const dashboard = {
      elements: {},
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

    const result = extractV2Inputs(dashboard);

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

    const result = extractV2Inputs(dashboard);

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

    const result = extractV2Inputs(dashboard);

    expect(result.dataSources).toHaveLength(0);
  });
});

describe('applyV1Inputs', () => {
  it('replaces templateized datasources across v1 dashboard', () => {
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

    const result = applyV1Inputs(dashboard, makeV1Inputs(), form);

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
                      query: { kind: 'prometheus' },
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
              spec: { group: 'prometheus' },
            },
          },
        },
      ],
      variables: [
        {
          kind: 'QueryVariable',
          spec: {
            query: {
              spec: { group: 'prometheus' },
            },
          },
        },
      ],
    } as unknown as DashboardV2Spec;

    const form: ImportFormDataV2 = {
      dashboard,
      folderUid: 'folder',
      message: '',
      'datasource-prometheus': { uid: 'ds-uid', type: 'prometheus', name: 'My DS' },
    };

    const result = applyV2Inputs(dashboard, form);

    const updatedAnnotation = result.annotations?.[0] as AnnotationQueryKind;
    expect(updatedAnnotation.spec.query?.datasource?.name).toBe('ds-uid');

    const updatedVariable = result.variables?.[0] as QueryVariableKind;
    expect(updatedVariable.spec.query?.spec?.datasource?.name).toBe('ds-uid');

    const updatedPanel = result.elements.panel as PanelKind;
    const queries = updatedPanel.spec.data?.kind === 'QueryGroup' ? updatedPanel.spec.data.spec.queries : [];
    const updatedQuery = queries[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const querySpec = updatedQuery?.spec as any;
    expect(querySpec?.datasource?.uid).toBe('ds-uid');
    expect(querySpec?.datasource?.type).toBe('prometheus');
  });
});
