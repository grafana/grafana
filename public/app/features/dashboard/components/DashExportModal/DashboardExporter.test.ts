import { find } from 'lodash';

import { DataSourceInstanceSettings, DataSourceRef, PanelPluginMeta } from '@grafana/data';
import { Dashboard, ThresholdsMode } from '@grafana/schema';
import config from 'app/core/config';

import { LibraryElementKind } from '../../../library-panels/types';
import { variableAdapters } from '../../../variables/adapters';
import { createConstantVariableAdapter } from '../../../variables/constant/adapter';
import { createDataSourceVariableAdapter } from '../../../variables/datasource/adapter';
import { createQueryVariableAdapter } from '../../../variables/query/adapter';
import { DashboardModel } from '../../state/DashboardModel';

import { DashboardExporter, LibraryElementExport } from './DashboardExporter';

jest.mock('app/core/store', () => {
  return {
    getBool: jest.fn(),
    getObject: jest.fn(),
  };
});

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => {
    return {
      get: (v: any) => {
        const s = getStubInstanceSettings(v);
        // console.log('GET', v, s);
        return Promise.resolve(s);
      },
      getInstanceSettings: getStubInstanceSettings,
    };
  },
  config: {
    buildInfo: {},
    panels: {},
    featureToggles: {
      newVariables: false,
    },
    angularSupportEnabled: true,
  },
}));

jest.mock('app/features/library-panels/state/api', () => ({
  getLibraryPanel: jest.fn().mockReturnValue(
    Promise.resolve({
      model: {
        type: 'graph',
        datasource: {
          type: 'testdb',
          uid: '${DS_GFDB}',
        },
      },
    })
  ),
}));

variableAdapters.register(createQueryVariableAdapter());
variableAdapters.register(createConstantVariableAdapter());
variableAdapters.register(createDataSourceVariableAdapter());

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
  const exporter = new DashboardExporter();
  const exported: any = await exporter.makeExportable(dashboardModel);
  expect(exported.templating.list[0].datasource.uid).toBe('${DS_GFDB}');
});

it('replaces datasource ref in library panel', async () => {
  const dashboard: Dashboard = {
    style: 'dark',
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

  const exporter = new DashboardExporter();
  const exported = await exporter.makeExportable(dashboardModel);
  if ('error' in exported) {
    throw new Error('error should not be returned when making exportable json');
  }
  expect(exported.__elements['c46a6b49-de40-43b3-982c-1b5e1ec084a4'].model.datasource.uid).toBe('${DS_GFDB}');
  expect(exported.__inputs[0].name).toBe('DS_GFDB');
});

it('If a panel queries has no datasource prop ignore it', async () => {
  const dashboard: any = {
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
  };
  const dashboardModel = new DashboardModel(dashboard, undefined, {
    getVariablesFromState: () => [],
  });
  const exporter = new DashboardExporter();
  const exported: any = await exporter.makeExportable(dashboardModel);
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
              // datasource: { uid: 'gfdb', type: 'testdb' },
              // type: 'graph',
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

    const exporter = new DashboardExporter();
    exporter.makeExportable(dash).then((clean) => {
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
    const testJson: any = {
      panels: [{ id: 1, datasource: { uid: 'other', type: 'other' }, type: 'graph' }],
    };
    const testDash = new DashboardModel(testJson);
    const exporter = new DashboardExporter();
    const exportedJson: any = await exporter.makeExportable(testDash);
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

  it('should replace datasource in annotation query', () => {
    expect(exported.annotations.list[1].datasource.uid).toBe('${DS_GFDB}');
  });

  it('should add datasource as input', () => {
    expect(exported.__inputs[0].name).toBe('DS_GFDB');
    expect(exported.__inputs[0].pluginId).toBe('testdb');
    expect(exported.__inputs[0].type).toBe('datasource');
  });

  it('should add datasource to required', () => {
    const require: any = find(exported.__requires, { name: 'TestDB' });
    expect(require.name).toBe('TestDB');
    expect(require.id).toBe('testdb');
    expect(require.type).toBe('datasource');
    expect(require.version).toBe('1.2.1');
  });

  it('should not add built in datasources to required', () => {
    const require: any = find(exported.__requires, { name: 'Mixed' });
    expect(require).toBe(undefined);
  });

  it('should add datasources used in mixed mode', () => {
    const require: any = find(exported.__requires, { name: 'OtherDB' });
    expect(require).not.toBe(undefined);
  });

  it('should add graph panel to required', () => {
    const require: any = find(exported.__requires, { name: 'Graph' });
    expect(require.name).toBe('Graph');
    expect(require.id).toBe('graph');
    expect(require.version).toBe('1.1.0');
  });

  it('should add table panel to required', () => {
    const require: any = find(exported.__requires, { name: 'Table' });
    expect(require.name).toBe('Table');
    expect(require.id).toBe('table');
    expect(require.version).toBe('1.1.1');
  });

  it('should add heatmap panel to required', () => {
    const require: any = find(exported.__requires, { name: 'Heatmap' });
    expect(require.name).toBe('Heatmap');
    expect(require.id).toBe('heatmap');
    expect(require.version).toBe('1.1.2');
  });

  it('should add grafana version', () => {
    const require: any = find(exported.__requires, { name: 'Grafana' });
    expect(require.type).toBe('grafana');
    expect(require.id).toBe('grafana');
    expect(require.version).toBe('3.0.2');
  });

  it('should add constant template variables as inputs', () => {
    const input: any = find(exported.__inputs, { name: 'VAR_PREFIX' });
    expect(input.type).toBe('constant');
    expect(input.label).toBe('prefix');
    expect(input.value).toBe('collectd');
  });

  it('should templatize constant variables', () => {
    const variable: any = find(exported.templating.list, { name: 'prefix' });
    expect(variable.query).toBe('${VAR_PREFIX}');
    expect(variable.current.text).toBe('${VAR_PREFIX}');
    expect(variable.current.value).toBe('${VAR_PREFIX}');
    expect(variable.options[0].text).toBe('${VAR_PREFIX}');
    expect(variable.options[0].value).toBe('${VAR_PREFIX}');
  });

  it('should add datasources only use via datasource variable to requires', () => {
    const require: any = find(exported.__requires, { name: 'OtherDB_2' });
    expect(require.id).toBe('other2');
  });

  it('should add library panels as elements', () => {
    const element: LibraryElementExport = exported.__elements['ah8NqyDPs'];
    expect(element.name).toBe('Library Panel 2');
    expect(element.kind).toBe(LibraryElementKind.Panel);
    expect(element.model).toEqual({
      datasource: { type: 'testdb', uid: '${DS_GFDB}' },
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
    });
  });
});

function getStubInstanceSettings(v: string | DataSourceRef): DataSourceInstanceSettings {
  let key = (v as DataSourceRef)?.type ?? v;
  return (stubs[(key as any) ?? 'gfdb'] ?? stubs['gfdb']) as any;
}

// Stub responses
const stubs: { [key: string]: {} } = {};
stubs['gfdb'] = {
  name: 'gfdb',
  meta: { id: 'testdb', info: { version: '1.2.1' }, name: 'TestDB' },
};

stubs['other'] = {
  name: 'other',
  meta: { id: 'other', info: { version: '1.2.1' }, name: 'OtherDB' },
};

stubs['other2'] = {
  name: 'other2',
  meta: { id: 'other2', info: { version: '1.2.1' }, name: 'OtherDB_2' },
};

stubs['mixed'] = {
  name: 'mixed',
  meta: {
    id: 'mixed',
    info: { version: '1.2.1' },
    name: 'Mixed',
    builtIn: true,
  },
};

stubs['grafana'] = {
  name: '-- Grafana --',
  meta: {
    id: 'grafana',
    info: { version: '1.2.1' },
    name: 'grafana',
    builtIn: true,
  },
};
