import { find } from 'lodash';

import { DataSourceInstanceSettings, DataSourceRef, PanelPluginMeta, TypedVariableModel } from '@grafana/data';
import { Dashboard, DashboardCursorSync, ThresholdsMode } from '@grafana/schema';
import {
  DatasourceVariableKind,
  LibraryPanelKind,
  PanelKind,
  QueryVariableKind,
} from '@grafana/schema/dist/esm/schema/dashboard/v2';
import { handyTestingSchema } from '@grafana/schema/dist/esm/schema/dashboard/v2_examples';
import config from 'app/core/config';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { createAdHocVariableAdapter } from 'app/features/variables/adhoc/adapter';

import { LibraryElementKind } from '../../../library-panels/types';
import { DashboardJson } from '../../../manage-dashboards/types';
import { variableAdapters } from '../../../variables/adapters';
import { createConstantVariableAdapter } from '../../../variables/constant/adapter';
import { createDataSourceVariableAdapter } from '../../../variables/datasource/adapter';
import { createQueryVariableAdapter } from '../../../variables/query/adapter';

import { makeExportableV1, makeExportableV2, LibraryElementExport } from './exporters';

jest.mock('app/core/store', () => {
  return {
    getBool: jest.fn(),
    getObject: jest.fn((_a, b) => b),
    get: jest.fn(),
  };
});

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => {
    return {
      get: (v: string | DataSourceRef) => {
        const s = getStubInstanceSettings(v);
        return Promise.resolve(s);
      },
      getInstanceSettings: getStubInstanceSettings,
    };
  },
  config: {
    buildInfo: {},
    panels: {},
    apps: {},
    featureToggles: {
      newVariables: false,
    },
  },
}));

jest.mock('app/features/library-panels/state/api', () => ({
  getLibraryPanel: jest.fn().mockImplementation((uid: string) => {
    if (uid === 'test-library-panel-uid') {
      return Promise.resolve({
        name: 'Test Library Panel',
        uid: 'test-library-panel-uid',
        model: {
          type: 'timeseries',
          datasource: {
            type: 'testdb',
            uid: 'gfdb',
          },
          targets: [
            {
              refId: 'A',
              datasource: {
                type: 'testdb',
                uid: 'gfdb',
              },
            },
          ],
          id: 123,
          title: 'Test Library Panel',
        },
      });
    }
    if (uid === 'invalid-uid') {
      return Promise.reject(new Error('Library panel not found'));
    }
    // Default behavior for other UIDs
    return Promise.resolve({
      name: 'Testing lib panel 1',
      uid: 'abc-123',
      model: {
        type: 'graph',
        datasource: {
          type: 'testdb',
          uid: '${DS_GFDB}',
        },
        targets: [
          {
            refId: 'A',
            datasource: {
              type: 'testdb',
              uid: '${DS_GFDB}',
            },
          },
        ],
      },
    });
  }),
}));

variableAdapters.register(createQueryVariableAdapter());
variableAdapters.register(createConstantVariableAdapter());
variableAdapters.register(createDataSourceVariableAdapter());
variableAdapters.register(createAdHocVariableAdapter());

describe('dashboard exporter v1', () => {
  it('handles a default datasource in a template variable', async () => {
    const dashboard: any = {
      templating: {
        list: [
          {
            current: {},
            definition: 'test',
            error: {},
            hide: 0,
            includeAll: false,
            multi: false,
            name: 'query0',
            options: [],
            query: {
              query: 'test',
              refId: 'StandardVariableQuery',
            },
            refresh: 1,
            regex: '',
            skipUrlSync: false,
            sort: 0,
            type: 'query',
          },
        ],
      },
    };
    const dashboardModel = new DashboardModel(dashboard, undefined, {
      getVariablesFromState: () => dashboard.templating.list,
    });

    const exported: any = await makeExportableV1(dashboardModel);
    expect(exported.templating.list[0].datasource.uid).toBe('${DS_GFDB}');
  });

  it('do not expose datasource name and id in a in a template variable of type datasource', async () => {
    const dashboard: Dashboard = {
      title: 'My dashboard',
      revision: 1,
      editable: false,
      graphTooltip: DashboardCursorSync.Off,
      schemaVersion: 1,
      timepicker: { hidden: true },
      timezone: '',
      panels: [
        {
          id: 1,
          type: 'timeseries',
          title: 'My panel title',
          gridPos: { x: 0, y: 0, w: 1, h: 1 },
        },
      ],
      templating: {
        list: [
          {
            current: {
              selected: false,
              text: 'my-prometheus-datasource',
              value: 'my-prometheus-datasource-uid',
            },
            hide: 0,
            includeAll: false,
            multi: false,
            name: 'query1',
            options: [],
            query: 'prometheus',
            refresh: 1,
            regex: '',
            skipUrlSync: false,
            type: 'datasource',
          },
        ],
      },
    };
    const dashboardModel = new DashboardModel(dashboard, undefined, {
      getVariablesFromState: () => dashboard.templating!.list! as TypedVariableModel[],
    });
    const exported = (await makeExportableV1(dashboardModel)) as DashboardJson;
    const value = exported?.templating?.list ? exported?.templating?.list[0].current : '';
    expect(value).toEqual({});
  });

  it('replaces datasource ref in library panel', async () => {
    const dashboard: Dashboard = {
      editable: true,
      graphTooltip: 1,
      schemaVersion: 38,
      panels: [
        {
          id: 1,
          title: 'Panel title',
          type: 'timeseries',
          options: {
            cellHeight: 'sm',
            footer: {
              countRows: false,
              fields: '',
              reducer: ['sum'],
              show: false,
            },
            showHeader: true,
          },
          transformations: [],
          transparent: false,
          fieldConfig: {
            defaults: {
              custom: {
                align: 'auto',
                cellOptions: {
                  type: 'auto',
                },
                inspect: false,
              },
              mappings: [],
              thresholds: {
                mode: ThresholdsMode.Absolute,
                steps: [
                  {
                    color: 'green',
                    value: 10,
                  },
                  {
                    color: 'red',
                    value: 80,
                  },
                ],
              },
            },
            overrides: [],
          },
          gridPos: {
            h: 8,
            w: 12,
            x: 0,
            y: 0,
          },
          libraryPanel: {
            name: 'Testing lib panel',
            uid: 'c46a6b49-de40-43b3-982c-1b5e1ec084a4',
          },
        },
      ],
    };

    const dashboardModel = new DashboardModel(dashboard, {});

    const exported = (await makeExportableV1(dashboardModel)) as DashboardJson;
    if ('error' in exported) {
      throw new Error('error should not be returned when making exportable json');
    }
    expect(exported.__elements!['c46a6b49-de40-43b3-982c-1b5e1ec084a4'].model.datasource.uid).toBe('${DS_GFDB}');
    expect(exported.__inputs![0].name).toBe('DS_GFDB');
  });

  it('If a panel queries has no datasource prop ignore it', async () => {
    const dashboard = {
      panels: [
        {
          id: 1,
          type: 'graph',
          datasource: {
            uid: 'other',
            type: 'other',
          },
          targets: [{ refId: 'A', a: 'A' }],
        },
      ],
    } as unknown as Dashboard;
    const dashboardModel = new DashboardModel(dashboard, undefined, {
      getVariablesFromState: () => [],
    });
    const exported: any = await makeExportableV1(dashboardModel);
    expect(exported.panels[0].datasource).toEqual({ uid: '${DS_OTHER}', type: 'other' });
    expect(exported.panels[0].targets[0].datasource).toEqual({ uid: '${DS_OTHER}', type: 'other' });
  });

  describe('given dashboard with repeated panels', () => {
    let dash: any, exported: any;

    beforeEach((done) => {
      dash = {
        templating: {
          list: [
            {
              name: 'apps',
              type: 'query',
              datasource: { uid: 'gfdb', type: 'testdb' },
              current: { value: 'Asd', text: 'Asd' },
              options: [{ value: 'Asd', text: 'Asd' }],
            },
            {
              name: 'prefix',
              type: 'constant',
              current: { value: 'collectd', text: 'collectd' },
              options: [],
              query: 'collectd',
            },
            {
              name: 'ds',
              type: 'datasource',
              query: 'other2',
              current: { value: 'other2', text: 'other2' },
              options: [],
            },
            {
              name: 'adhoc',
              type: 'adhoc',
              datasource: { uid: 'gfdb', type: 'testdb' },
            },
          ],
        },
        annotations: {
          list: [
            {
              name: 'logs',
              datasource: 'gfdb',
            },
          ],
        },
        panels: [
          { id: 6, datasource: { uid: 'gfdb', type: 'testdb' }, type: 'graph' },
          { id: 7 },
          {
            id: 8,
            datasource: { uid: '-- Mixed --', type: 'mixed' },
            targets: [{ datasource: { uid: 'other', type: 'other' } }],
          },
          { id: 9, datasource: { uid: '$ds', type: 'other2' } },
          {
            id: 17,
            libraryPanel: {
              name: 'Library Panel 2',
              uid: 'ah8NqyDPs',
            },
          },
          {
            id: 2,
            repeat: 'apps',
            datasource: { uid: 'gfdb', type: 'testdb' },
            type: 'graph',
          },
          { id: 3, repeat: null, repeatPanelId: 2 },
          {
            id: 4,
            collapsed: true,
            panels: [
              { id: 10, datasource: { uid: 'gfdb', type: 'testdb' }, type: 'table' },
              { id: 11 },
              {
                id: 12,
                datasource: { uid: '-- Mixed --', type: 'mixed' },
                targets: [{ datasource: { uid: 'other', type: 'other' } }],
              },
              { id: 13, datasource: { uid: '$uid', type: 'other' } },
              {
                id: 14,
                repeat: 'apps',
                datasource: { uid: 'gfdb', type: 'testdb' },
                type: 'heatmap',
              },
              { id: 15, repeat: null, repeatPanelId: 14 },
              {
                id: 16,
                datasource: { uid: 'gfdb', type: 'testdb' },
                type: 'graph',
                libraryPanel: {
                  name: 'Library Panel',
                  uid: 'jL6MrxCMz',
                },
              },
            ],
          },
          {
            id: 5,
            targets: [{ scenarioId: 'random_walk', refId: 'A' }],
          },
        ],
      };

      config.buildInfo.version = '3.0.2';

      config.panels['graph'] = {
        id: 'graph',
        name: 'Graph',
        info: { version: '1.1.0' },
      } as PanelPluginMeta;

      config.panels['table'] = {
        id: 'table',
        name: 'Table',
        info: { version: '1.1.1' },
      } as PanelPluginMeta;

      config.panels['heatmap'] = {
        id: 'heatmap',
        name: 'Heatmap',
        info: { version: '1.1.2' },
      } as PanelPluginMeta;

      dash = new DashboardModel(
        dash,
        {},
        {
          getVariablesFromState: () => dash.templating.list,
        }
      );

      // init library panels
      dash.getPanelById(17).initLibraryPanel({
        uid: 'ah8NqyDPs',
        name: 'Library Panel 2',
        model: {
          datasource: { type: 'other2', uid: '$ds' },
          targets: [{ refId: 'A', datasource: { type: 'other2', uid: '$ds' } }],
          type: 'graph',
        },
      });

      makeExportableV1(dash).then((clean) => {
        exported = clean;
        done();
      });
    });

    it('should replace datasource refs', () => {
      const panel = exported.panels[0];
      expect(panel.datasource.uid).toBe('${DS_GFDB}');
    });

    it('should explicitly specify default datasources', () => {
      const panel = exported.panels[7];
      expect(exported.__inputs.some((ds: Record<string, string>) => ds.name === 'DS_GFDB')).toBeTruthy();
      expect(panel.datasource.uid).toBe('${DS_GFDB}');
      expect(panel.targets[0].datasource).toEqual({ type: 'testdb', uid: '${DS_GFDB}' });
    });

    it('should not include default datasource in __inputs unnecessarily', async () => {
      const testJson = {
        panels: [{ id: 1, datasource: { uid: 'other', type: 'other' }, type: 'graph' }],
      } as unknown as Dashboard;
      const testDash = new DashboardModel(testJson);
      const exportedJson: any = await makeExportableV1(testDash);
      expect(exportedJson.__inputs.some((ds: Record<string, string>) => ds.name === 'DS_GFDB')).toBeFalsy();
    });

    it('should replace datasource refs in collapsed row', () => {
      const panel = exported.panels[6].panels[0];
      expect(panel.datasource.uid).toBe('${DS_GFDB}');
    });

    it('should replace datasource in variable query', () => {
      expect(exported.templating.list[0].datasource.uid).toBe('${DS_GFDB}');
      expect(exported.templating.list[0].options.length).toBe(0);
      expect(exported.templating.list[0].current.value).toBe(undefined);
      expect(exported.templating.list[0].current.text).toBe(undefined);
    });

    it('should replace datasource in adhoc query', () => {
      expect(exported.templating.list[3].datasource.uid).toBe('${DS_GFDB}');
    });

    it('should replace datasource in annotation query', () => {
      expect(exported.annotations.list[1].datasource.uid).toBe('${DS_GFDB}');
    });

    it('should add datasource as input', () => {
      expect(exported.__inputs[0].name).toBe('DS_GFDB');
      expect(exported.__inputs[0].pluginId).toBe('testdb');
      expect(exported.__inputs[0].type).toBe('datasource');
    });

    it('should add datasource to required', () => {
      const require = find(exported.__requires, { name: 'TestDB' });
      expect(require.name).toBe('TestDB');
      expect(require.id).toBe('testdb');
      expect(require.type).toBe('datasource');
      expect(require.version).toBe('1.2.1');
    });

    it('should not add built in datasources to required', () => {
      const require = find(exported.__requires, { name: 'Mixed' });
      expect(require).toBe(undefined);
    });

    it('should add datasources used in mixed mode', () => {
      const require = find(exported.__requires, { name: 'OtherDB' });
      expect(require).not.toBe(undefined);
    });

    it('should add graph panel to required', () => {
      const require = find(exported.__requires, { name: 'Graph' });
      expect(require.name).toBe('Graph');
      expect(require.id).toBe('graph');
      expect(require.version).toBe('1.1.0');
    });

    it('should add table panel to required', () => {
      const require = find(exported.__requires, { name: 'Table' });
      expect(require.name).toBe('Table');
      expect(require.id).toBe('table');
      expect(require.version).toBe('1.1.1');
    });

    it('should add heatmap panel to required', () => {
      const require = find(exported.__requires, { name: 'Heatmap' });
      expect(require.name).toBe('Heatmap');
      expect(require.id).toBe('heatmap');
      expect(require.version).toBe('1.1.2');
    });

    it('should add grafana version', () => {
      const require = find(exported.__requires, { name: 'Grafana' });
      expect(require.type).toBe('grafana');
      expect(require.id).toBe('grafana');
      expect(require.version).toBe('3.0.2');
    });

    it('should add constant template variables as inputs', () => {
      const input = find(exported.__inputs, { name: 'VAR_PREFIX' });
      expect(input.type).toBe('constant');
      expect(input.label).toBe('prefix');
      expect(input.value).toBe('collectd');
    });

    it('should templatize constant variables', () => {
      const variable = find(exported.templating.list, { name: 'prefix' });
      expect(variable.query).toBe('${VAR_PREFIX}');
      expect(variable.current.text).toBe('${VAR_PREFIX}');
      expect(variable.current.value).toBe('${VAR_PREFIX}');
      expect(variable.options[0].text).toBe('${VAR_PREFIX}');
      expect(variable.options[0].value).toBe('${VAR_PREFIX}');
    });

    it('should add datasources only use via datasource variable to requires', () => {
      const require = find(exported.__requires, { name: 'OtherDB_2' });
      expect(require.id).toBe('other2');
    });

    it('should add library panels as elements', () => {
      const element: LibraryElementExport = exported.__elements['ah8NqyDPs'];
      expect(element.name).toBe('Library Panel 2');
      expect(element.kind).toBe(LibraryElementKind.Panel);
      expect(element.model).toEqual({
        datasource: { type: 'testdb', uid: '${DS_GFDB}' },
        targets: [
          {
            datasource: { type: 'testdb', uid: '${DS_GFDB}' },
            refId: 'A',
          },
        ],
        type: 'graph',
      });
    });

    it('should add library panels in collapsed rows as elements', () => {
      const element: LibraryElementExport = exported.__elements['jL6MrxCMz'];
      expect(element.name).toBe('Library Panel');
      expect(element.kind).toBe(LibraryElementKind.Panel);
      expect(element.model).toEqual({
        type: 'graph',
        datasource: {
          type: 'testdb',
          uid: '${DS_GFDB}',
        },
        targets: [
          {
            datasource: { type: 'testdb', uid: '${DS_GFDB}' },
            refId: 'A',
          },
        ],
      });
    });
  });
});

describe('dashboard exporter v2', () => {
  const setup = async () => {
    // Making a deep copy here because original JSON is mutated by the exporter
    const schemaCopy = JSON.parse(JSON.stringify(handyTestingSchema));

    // add a panel that uses a datasource variable
    schemaCopy.elements['panel-using-datasource-var'] = {
      kind: 'Panel',
      spec: {
        data: {
          kind: 'QueryGroup',
          spec: {
            queries: [
              {
                kind: 'PanelQuery',
                spec: {
                  hidden: false,
                  query: {
                    datasource: {
                      name: '${datasourceVar}',
                    },
                    group: 'prometheus',
                    spec: {
                      editorMode: 'builder',
                      expr: 'go_goroutines{job="prometheus"}',
                      includeNullMetadata: true,
                      legendFormat: '__auto',
                      range: true,
                    },
                  },
                  refId: 'A',
                },
              },
            ],
          },
        },
      },
    };

    const dashboard = await makeExportableV2(schemaCopy);
    if (typeof dashboard === 'object' && 'error' in dashboard) {
      throw dashboard.error;
    }
    return { dashboard, originalSchema: handyTestingSchema };
  };

  it('should replace datasource in a query variable', async () => {
    const { dashboard } = await setup();
    const variable = dashboard.variables[0] as QueryVariableKind;
    expect(variable.spec.query.datasource?.name).toBeUndefined();
  });

  it('do not expose datasource name and id in datasource variable', async () => {
    const { dashboard } = await setup();
    const variable = dashboard.variables[2] as DatasourceVariableKind;
    expect(variable.kind).toBe('DatasourceVariable');
    expect(variable.spec.current).toEqual({ text: '', value: '' });
  });

  it('should replace datasource in annotation query', async () => {
    const { dashboard } = await setup();
    const annotationQuery = dashboard.annotations[0];

    expect(annotationQuery.spec.query?.datasource?.name).toBeUndefined();
  });

  it('should not remove datasource ref from panel that uses a datasource variable', async () => {
    const { dashboard } = await setup();
    const panel = dashboard.elements['panel-using-datasource-var'];

    if (panel.kind !== 'Panel') {
      throw new Error('Panel should be a Panel');
    }
    expect(panel.spec.data.spec.queries[0].spec.query.datasource?.name).toBe('${datasourceVar}');
    expect(panel.spec.data.spec.queries[0].spec.query.group).toBe('prometheus');
  });

  it('should convert library panels to inline panels when sharing externally', async () => {
    const setupWithLibraryPanel = async (isSharingExternally: boolean) => {
      const schemaCopy = JSON.parse(JSON.stringify(handyTestingSchema));

      // Add a library panel to test conversion
      schemaCopy.elements['test-library-panel'] = {
        kind: 'LibraryPanel',
        spec: {
          id: 123,
          title: 'Test Library Panel',
          libraryPanel: {
            uid: 'test-library-panel-uid',
            name: 'Test Library Panel',
          },
        },
      };

      // Handle makeExportableV2 union return type: DashboardV2Spec | { error: unknown }
      const dashboard = await makeExportableV2(schemaCopy, isSharingExternally);
      if (typeof dashboard === 'object' && 'error' in dashboard) {
        throw dashboard.error;
      }
      return { dashboard, originalSchema: schemaCopy };
    };

    const { dashboard } = await setupWithLibraryPanel(true); // isSharingExternally = true

    // Library panel should be converted to inline panel
    const convertedPanel = dashboard.elements['test-library-panel'] as PanelKind;
    expect(convertedPanel.kind).toBe('Panel');
    expect(convertedPanel.spec.id).toBe(123);

    // Check that the panel was properly converted
    expect(convertedPanel.spec.data.spec.queries[0].spec.query.kind).toBe('DataQuery');
    expect(convertedPanel.spec.data.spec.queries[0].spec.refId).toBe('A');
  });

  it('should keep library panels as-is when not sharing externally', async () => {
    const setupWithLibraryPanel = async (isSharingExternally: boolean) => {
      const schemaCopy = JSON.parse(JSON.stringify(handyTestingSchema));

      // Add a library panel
      schemaCopy.elements['test-library-panel'] = {
        kind: 'LibraryPanel',
        spec: {
          id: 124,
          title: 'Test Library Panel',
          libraryPanel: {
            uid: 'abc-123',
            name: 'Testing lib panel 1',
          },
        },
      };

      // Handle makeExportableV2 union return type: DashboardV2Spec | { error: unknown }
      const dashboard = await makeExportableV2(schemaCopy, isSharingExternally);
      if (typeof dashboard === 'object' && 'error' in dashboard) {
        throw dashboard.error;
      }
      return { dashboard, originalSchema: schemaCopy };
    };

    const { dashboard } = await setupWithLibraryPanel(false); // isSharingExternally = false

    // Library panel should remain as library panel
    const libraryPanel = dashboard.elements['test-library-panel'];
    expect(libraryPanel.kind).toBe('LibraryPanel');
    expect((libraryPanel as LibraryPanelKind).spec.libraryPanel.uid).toBe('abc-123');
  });

  it('should handle library panel conversion errors gracefully', async () => {
    // Mock console.error to avoid Jest warnings
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const setupWithInvalidLibraryPanel = async () => {
      const schemaCopy = JSON.parse(JSON.stringify(handyTestingSchema));

      // Add a library panel with invalid uid that will cause getLibraryPanel to fail
      schemaCopy.elements['invalid-library-panel'] = {
        kind: 'LibraryPanel',
        spec: {
          id: 125,
          title: 'Invalid Library Panel',
          libraryPanel: {
            uid: 'invalid-uid',
            name: 'Invalid Library Panel',
          },
        },
      };

      // Handle makeExportableV2 union return type: DashboardV2Spec | { error: unknown }
      const dashboard = await makeExportableV2(schemaCopy, true); // isSharingExternally = true
      if (typeof dashboard === 'object' && 'error' in dashboard) {
        throw dashboard.error;
      }

      return { dashboard, originalSchema: schemaCopy };
    };

    const { dashboard } = await setupWithInvalidLibraryPanel();

    // Should return a placeholder panel
    const placeholderPanel = dashboard.elements['invalid-library-panel'];
    expect(placeholderPanel.kind).toBe('Panel');
    expect((placeholderPanel as PanelKind).spec.id).toBe(125);
    expect((placeholderPanel as PanelKind).spec.title).toBe('Invalid Library Panel');
    expect((placeholderPanel as PanelKind).spec.vizConfig.kind).toBe('VizConfig');
    expect((placeholderPanel as PanelKind).spec.vizConfig.group).toBe('text');

    // Verify console.error was called
    expect(consoleSpy).toHaveBeenCalledWith('Failed to load library panel invalid-uid:', expect.any(Error));

    // Restore console.error
    consoleSpy.mockRestore();
  });
});

function getStubInstanceSettings(v: string | DataSourceRef): DataSourceInstanceSettings {
  let key = (v as DataSourceRef)?.type ?? v;
  return stubs[(key as string) ?? 'gfdb'] ?? stubs['gfdb'];
}

// Stub responses
const stubs: { [key: string]: DataSourceInstanceSettings } = {};
stubs['gfdb'] = {
  name: 'gfdb',
  meta: { id: 'testdb', info: { version: '1.2.1' }, name: 'TestDB' },
} as DataSourceInstanceSettings;

stubs['other'] = {
  name: 'other',
  meta: { id: 'other', info: { version: '1.2.1' }, name: 'OtherDB' },
} as DataSourceInstanceSettings;

stubs['other2'] = {
  name: 'other2',
  meta: { id: 'other2', info: { version: '1.2.1' }, name: 'OtherDB_2' },
} as DataSourceInstanceSettings;

stubs['mixed'] = {
  name: 'mixed',
  meta: {
    id: 'mixed',
    info: { version: '1.2.1' },
    name: 'Mixed',
    builtIn: true,
  },
} as DataSourceInstanceSettings;

stubs['grafana'] = {
  name: '-- Grafana --',
  meta: {
    id: 'grafana',
    info: { version: '1.2.1' },
    name: 'grafana',
    builtIn: true,
  },
} as DataSourceInstanceSettings;
