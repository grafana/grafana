import { find } from 'lodash';

import { DataSourceInstanceSettings, DataSourceRef, PanelPluginMeta, TypedVariableModel } from '@grafana/data';
import { Dashboard, DashboardCursorSync, ThresholdsMode } from '@grafana/schema';
import config from 'app/core/config';

import { LibraryElementKind } from '../../../library-panels/types';
import { DashboardJson } from '../../../manage-dashboards/types';
import { variableAdapters } from '../../../variables/adapters';
import { createConstantVariableAdapter } from '../../../variables/constant/adapter';
import { createDataSourceVariableAdapter } from '../../../variables/datasource/adapter';
import { createQueryVariableAdapter } from '../../../variables/query/adapter';
import { DashboardModel } from '../../state/DashboardModel';

import { DashboardExporter, LibraryElementExport } from './DashboardExporter';

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
  // BMC Code
  getBackendSrv: () => {
    return {
      get: (url: string) => {
        return Promise.resolve([
          {
            name: 'Incident Management',
            id: '1',
          },
          {
            name: 'Product Management',
            id: '2',
          },
        ]);
      },
    };
  },
  config: {
    buildInfo: {},
    panels: {},
    apps: {},
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
  const exporter = new DashboardExporter();
  const exported = (await exporter.makeExportable(dashboardModel)) as DashboardJson;
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

  const exporter = new DashboardExporter();
  const exported = await exporter.makeExportable(dashboardModel);
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
    const testJson = {
      panels: [{ id: 1, datasource: { uid: 'other', type: 'other' }, type: 'graph' }],
    } as unknown as Dashboard;
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

  // BMC code: start
  // VQB Export test case START
  it('should add VQB panels in inputs block of external export', async () => {
    const dashboard: any = {
      datasource: {
        type: 'bmchelix-ade-datasource',
        uid: '${DS_BMC_HELIX}',
      },
      fieldConfig: {
        defaults: {
          color: {
            mode: 'thresholds',
          },
          custom: {
            align: 'auto',
            cellOptions: {
              type: 'auto',
            },
            inspect: false,
          },
          mappings: [],
        },
        overrides: [],
      },
      gridPos: {
        h: 8,
        w: 12,
        x: 12,
        y: 0,
      },
      id: 15,
      pluginVersion: '9.5.3',
      targets: [
        {
          datasource: {
            type: 'bmchelix-ade-datasource',
            uid: '${DS_BMC_HELIX}',
          },
          refId: 'A',
          sourceQuery: {
            dstType: 'SERVER',
            formatAs: 'Table',
            guid: 'bc601d0c-8867-a7f6-cc1f-adf08163af8a',
            header: {
              headerList: [
                {
                  arKey: 'date_format',
                  arType: 'body',
                  collapseHeader: false,
                  dataType: 'string',
                  text: 'Date Format',
                  value: 'DD/MM/YYYY',
                },
              ],
              hideHeader: true,
            },
            queryType: 'Views',
            rawQuery:
              'SELECT DISTINCT \r\n          HPD_HELP_DESK_ASSIGNMENT_LOG.`Submit Date` AS `Assignment Submit Date`\r\n         ,HPD_HELP_DESK_ASSIGNMENT_LOG.`Last Modified By` AS `Last Modified By`\r\n         ,HPD_HELP_DESK.`Incident Number` AS `Incident Number`\r\n         ,HPD_HELP_DESK.Urgency AS `Urgency`\r\n         ,HPD_HELP_DESK.Submitter AS `Submitter`\r\n\r\nFROM `AR System Schema`.`HPD:Help Desk` HPD_HELP_DESK LEFT OUTER JOIN `AR System Schema`.`HPD:Help Desk Assignment Log` HPD_HELP_DESK_ASSIGNMENT_LOG\r\n     ON ( HPD_HELP_DESK.`Incident Number` = HPD_HELP_DESK_ASSIGNMENT_LOG.`Incident Number` )\r\n\r\n',
            view: {
              selectedFields: [
                {
                  aggregation: 'NONE',
                  columnId: 'HPD_ASSIGNMENT_LOG_SUBMIT_DATE',
                  datatype: 'DATE',
                  target_column: 'Assignment Submit Date',
                  target_column_type: 'COLUMN_NAME',
                },
              ],
              selectedView: {
                viewName: 'Incident Management',
                viewID: '1',
              },
            },
          },
          sourceType: 'remedy',
        },
      ],
      title: 'Outer JOin1',
      type: 'table',
    };
    const dashboardModel = new DashboardModel(dashboard, undefined, {
      getVariablesFromState: () => dashboard.templating.list,
    });
    const exporter = new DashboardExporter();
    const exported: any = await exporter.makeExportable(dashboardModel);
    expect(exported.__inputs.some((inputRow: Record<string, string>) => inputRow.type === 'view')).toBeTruthy();
    expect(
      exported.__inputs.some((inputRow: Record<string, string>) => inputRow.label === 'Incident Management')
    ).toBeTruthy();
  });

  it('should add old or existing VQB panels in inputs block of external export', async () => {
    const dashboard: any = {
      datasource: {
        type: 'bmchelix-ade-datasource',
        uid: '${DS_BMC_HELIX}',
      },
      fieldConfig: {
        defaults: {
          color: {
            mode: 'thresholds',
          },
          custom: {
            align: 'auto',
            cellOptions: {
              type: 'auto',
            },
            inspect: false,
          },
          mappings: [],
        },
        overrides: [],
      },
      gridPos: {
        h: 8,
        w: 12,
        x: 12,
        y: 0,
      },
      id: 15,
      pluginVersion: '9.5.3',
      targets: [
        {
          datasource: {
            type: 'bmchelix-ade-datasource',
            uid: '${DS_BMC_HELIX}',
          },
          refId: 'A',
          sourceQuery: {
            dstType: 'SERVER',
            formatAs: 'Table',
            guid: 'bc601d0c-8867-a7f6-cc1f-adf08163af8a',
            header: {
              headerList: [
                {
                  arKey: 'date_format',
                  arType: 'body',
                  collapseHeader: false,
                  dataType: 'string',
                  text: 'Date Format',
                  value: 'DD/MM/YYYY',
                },
              ],
              hideHeader: true,
            },
            queryType: 'Views',
            rawQuery:
              'SELECT DISTINCT \r\n          HPD_HELP_DESK_ASSIGNMENT_LOG.`Submit Date` AS `Assignment Submit Date`\r\n         ,HPD_HELP_DESK_ASSIGNMENT_LOG.`Last Modified By` AS `Last Modified By`\r\n         ,HPD_HELP_DESK.`Incident Number` AS `Incident Number`\r\n         ,HPD_HELP_DESK.Urgency AS `Urgency`\r\n         ,HPD_HELP_DESK.Submitter AS `Submitter`\r\n\r\nFROM `AR System Schema`.`HPD:Help Desk` HPD_HELP_DESK LEFT OUTER JOIN `AR System Schema`.`HPD:Help Desk Assignment Log` HPD_HELP_DESK_ASSIGNMENT_LOG\r\n     ON ( HPD_HELP_DESK.`Incident Number` = HPD_HELP_DESK_ASSIGNMENT_LOG.`Incident Number` )\r\n\r\n',
            view: {
              selectedFields: [
                {
                  aggregation: 'NONE',
                  columnId: 'HPD_ASSIGNMENT_LOG_SUBMIT_DATE',
                  datatype: 'DATE',
                  target_column: 'Assignment Submit Date',
                  target_column_type: 'COLUMN_NAME',
                },
              ],
              selectedView: '1',
            },
          },
          sourceType: 'remedy',
        },
      ],
      title: 'Outer JOin1',
      type: 'table',
    };
    const dashboardModel = new DashboardModel(dashboard, undefined, {
      getVariablesFromState: () => dashboard.templating.list,
    });
    const exporter = new DashboardExporter();
    const exported: any = await exporter.makeExportable(dashboardModel);
    expect(exported.__inputs.some((inputRow: Record<string, string>) => inputRow.type === 'view')).toBeTruthy();
  });
  // VQB Test END
  // BMC code: end
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
