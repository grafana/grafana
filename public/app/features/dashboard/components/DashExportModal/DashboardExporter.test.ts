jest.mock('app/core/store', () => {
  return {
    getBool: jest.fn(),
  };
});

import _ from 'lodash';
import config from 'app/core/config';
import { DashboardExporter } from './DashboardExporter';
import { DashboardModel } from '../../state/DashboardModel';
import { DatasourceSrv } from 'app/features/plugins/datasource_srv';
import { PanelPlugin } from 'app/types';

describe('given dashboard with repeated panels', () => {
  let dash: any, exported: any;

  beforeEach(done => {
    dash = {
      templating: {
        list: [
          {
            name: 'apps',
            type: 'query',
            datasource: 'gfdb',
            current: { value: 'Asd', text: 'Asd' },
            options: [{ value: 'Asd', text: 'Asd' }],
          },
          {
            name: 'prefix',
            type: 'constant',
            current: { value: 'collectd', text: 'collectd' },
            options: [],
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
        { id: 6, datasource: 'gfdb', type: 'graph' },
        { id: 7 },
        {
          id: 8,
          datasource: '-- Mixed --',
          targets: [{ datasource: 'other' }],
        },
        { id: 9, datasource: '$ds' },
        {
          id: 2,
          repeat: 'apps',
          datasource: 'gfdb',
          type: 'graph',
        },
        { id: 3, repeat: null, repeatPanelId: 2 },
        {
          id: 4,
          collapsed: true,
          panels: [
            { id: 10, datasource: 'gfdb', type: 'table' },
            { id: 11 },
            {
              id: 12,
              datasource: '-- Mixed --',
              targets: [{ datasource: 'other' }],
            },
            { id: 13, datasource: '$ds' },
            {
              id: 14,
              repeat: 'apps',
              datasource: 'gfdb',
              type: 'heatmap',
            },
            { id: 15, repeat: null, repeatPanelId: 14 },
          ],
        },
      ],
    };

    config.buildInfo.version = '3.0.2';

    //Stubs test function calls
    const datasourceSrvStub = ({ get: jest.fn(arg => getStub(arg)) } as any) as DatasourceSrv;

    config.panels['graph'] = {
      id: 'graph',
      name: 'Graph',
      info: { version: '1.1.0' },
    } as PanelPlugin;

    config.panels['table'] = {
      id: 'table',
      name: 'Table',
      info: { version: '1.1.1' },
    } as PanelPlugin;

    config.panels['heatmap'] = {
      id: 'heatmap',
      name: 'Heatmap',
      info: { version: '1.1.2' },
    } as PanelPlugin;

    dash = new DashboardModel(dash, {});
    const exporter = new DashboardExporter(datasourceSrvStub);
    exporter.makeExportable(dash).then(clean => {
      exported = clean;
      done();
    });
  });

  it('should replace datasource refs', () => {
    const panel = exported.panels[0];
    expect(panel.datasource).toBe('${DS_GFDB}');
  });

  it('should replace datasource refs in collapsed row', () => {
    const panel = exported.panels[5].panels[0];
    expect(panel.datasource).toBe('${DS_GFDB}');
  });

  it('should replace datasource in variable query', () => {
    expect(exported.templating.list[0].datasource).toBe('${DS_GFDB}');
    expect(exported.templating.list[0].options.length).toBe(0);
    expect(exported.templating.list[0].current.value).toBe(undefined);
    expect(exported.templating.list[0].current.text).toBe(undefined);
  });

  it('should replace datasource in annotation query', () => {
    expect(exported.annotations.list[1].datasource).toBe('${DS_GFDB}');
  });

  it('should add datasource as input', () => {
    expect(exported.__inputs[0].name).toBe('DS_GFDB');
    expect(exported.__inputs[0].pluginId).toBe('testdb');
    expect(exported.__inputs[0].type).toBe('datasource');
  });

  it('should add datasource to required', () => {
    const require: any = _.find(exported.__requires, { name: 'TestDB' });
    expect(require.name).toBe('TestDB');
    expect(require.id).toBe('testdb');
    expect(require.type).toBe('datasource');
    expect(require.version).toBe('1.2.1');
  });

  it('should not add built in datasources to required', () => {
    const require: any = _.find(exported.__requires, { name: 'Mixed' });
    expect(require).toBe(undefined);
  });

  it('should add datasources used in mixed mode', () => {
    const require: any = _.find(exported.__requires, { name: 'OtherDB' });
    expect(require).not.toBe(undefined);
  });

  it('should add graph panel to required', () => {
    const require: any = _.find(exported.__requires, { name: 'Graph' });
    expect(require.name).toBe('Graph');
    expect(require.id).toBe('graph');
    expect(require.version).toBe('1.1.0');
  });

  it('should add table panel to required', () => {
    const require: any = _.find(exported.__requires, { name: 'Table' });
    expect(require.name).toBe('Table');
    expect(require.id).toBe('table');
    expect(require.version).toBe('1.1.1');
  });

  it('should add heatmap panel to required', () => {
    const require: any = _.find(exported.__requires, { name: 'Heatmap' });
    expect(require.name).toBe('Heatmap');
    expect(require.id).toBe('heatmap');
    expect(require.version).toBe('1.1.2');
  });

  it('should add grafana version', () => {
    const require: any = _.find(exported.__requires, { name: 'Grafana' });
    expect(require.type).toBe('grafana');
    expect(require.id).toBe('grafana');
    expect(require.version).toBe('3.0.2');
  });

  it('should add constant template variables as inputs', () => {
    const input: any = _.find(exported.__inputs, { name: 'VAR_PREFIX' });
    expect(input.type).toBe('constant');
    expect(input.label).toBe('prefix');
    expect(input.value).toBe('collectd');
  });

  it('should templatize constant variables', () => {
    const variable: any = _.find(exported.templating.list, { name: 'prefix' });
    expect(variable.query).toBe('${VAR_PREFIX}');
    expect(variable.current.text).toBe('${VAR_PREFIX}');
    expect(variable.current.value).toBe('${VAR_PREFIX}');
    expect(variable.options[0].text).toBe('${VAR_PREFIX}');
    expect(variable.options[0].value).toBe('${VAR_PREFIX}');
  });

  it('should add datasources only use via datasource variable to requires', () => {
    const require: any = _.find(exported.__requires, { name: 'OtherDB_2' });
    expect(require.id).toBe('other2');
  });
});

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

stubs['-- Mixed --'] = {
  name: 'mixed',
  meta: {
    id: 'mixed',
    info: { version: '1.2.1' },
    name: 'Mixed',
    builtIn: true,
  },
};

stubs['-- Grafana --'] = {
  name: '-- Grafana --',
  meta: {
    id: 'grafana',
    info: { version: '1.2.1' },
    name: 'grafana',
    builtIn: true,
  },
};

function getStub(arg: string) {
  return Promise.resolve(stubs[arg || 'gfdb']);
}
