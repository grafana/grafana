import { describe, beforeEach, it, sinon, expect } from 'test/lib/common';

import _ from 'lodash';
import config from 'app/core/config';
import { DashboardExporter } from '../export/exporter';
import { DashboardModel } from '../dashboard_model';

describe('given dashboard with repeated panels', function() {
  var dash, exported;

  beforeEach(done => {
    dash = {
      templating: { list: [] },
      annotations: { list: [] },
    };

    config.buildInfo = {
      version: '3.0.2',
    };

    dash.templating.list.push({
      name: 'apps',
      type: 'query',
      datasource: 'gfdb',
      current: { value: 'Asd', text: 'Asd' },
      options: [{ value: 'Asd', text: 'Asd' }],
    });

    dash.templating.list.push({
      name: 'prefix',
      type: 'constant',
      current: { value: 'collectd', text: 'collectd' },
      options: [],
    });

    dash.templating.list.push({
      name: 'ds',
      type: 'datasource',
      query: 'testdb',
      current: { value: 'prod', text: 'prod' },
      options: [],
    });

    dash.annotations.list.push({
      name: 'logs',
      datasource: 'gfdb',
    });

    dash.panels = [
      { id: 6, datasource: 'gfdb', type: 'graph' },
      { id: 7 },
      {
        id: 8,
        datasource: '-- Mixed --',
        targets: [{ datasource: 'other' }],
      },
      { id: 9, datasource: '$ds' },
    ];

    dash.panels.push({
      id: 2,
      repeat: 'apps',
      datasource: 'gfdb',
      type: 'graph',
    });
    dash.panels.push({ id: 3, repeat: null, repeatPanelId: 2 });

    var datasourceSrvStub = { get: sinon.stub() };
    datasourceSrvStub.get.withArgs('gfdb').returns(
      Promise.resolve({
        name: 'gfdb',
        meta: { id: 'testdb', info: { version: '1.2.1' }, name: 'TestDB' },
      })
    );
    datasourceSrvStub.get.withArgs('other').returns(
      Promise.resolve({
        name: 'other',
        meta: { id: 'other', info: { version: '1.2.1' }, name: 'OtherDB' },
      })
    );
    datasourceSrvStub.get.withArgs('-- Mixed --').returns(
      Promise.resolve({
        name: 'mixed',
        meta: {
          id: 'mixed',
          info: { version: '1.2.1' },
          name: 'Mixed',
          builtIn: true,
        },
      })
    );
    datasourceSrvStub.get.withArgs('-- Grafana --').returns(
      Promise.resolve({
        name: '-- Grafana --',
        meta: {
          id: 'grafana',
          info: { version: '1.2.1' },
          name: 'grafana',
          builtIn: true,
        },
      })
    );

    config.panels['graph'] = {
      id: 'graph',
      name: 'Graph',
      info: { version: '1.1.0' },
    };

    dash = new DashboardModel(dash, {});
    var exporter = new DashboardExporter(datasourceSrvStub);
    exporter.makeExportable(dash).then(clean => {
      exported = clean;
      done();
    });
  });

  it('should replace datasource refs', function() {
    var panel = exported.panels[0];
    expect(panel.datasource).to.be('${DS_GFDB}');
  });

  it('should replace datasource in variable query', function() {
    expect(exported.templating.list[0].datasource).to.be('${DS_GFDB}');
    expect(exported.templating.list[0].options.length).to.be(0);
    expect(exported.templating.list[0].current.value).to.be(undefined);
    expect(exported.templating.list[0].current.text).to.be(undefined);
  });

  it('should replace datasource in annotation query', function() {
    expect(exported.annotations.list[1].datasource).to.be('${DS_GFDB}');
  });

  it('should add datasource as input', function() {
    expect(exported.__inputs[0].name).to.be('DS_GFDB');
    expect(exported.__inputs[0].pluginId).to.be('testdb');
    expect(exported.__inputs[0].type).to.be('datasource');
  });

  it('should add datasource to required', function() {
    var require = _.find(exported.__requires, { name: 'TestDB' });
    expect(require.name).to.be('TestDB');
    expect(require.id).to.be('testdb');
    expect(require.type).to.be('datasource');
    expect(require.version).to.be('1.2.1');
  });

  it('should not add built in datasources to required', function() {
    var require = _.find(exported.__requires, { name: 'Mixed' });
    expect(require).to.be(undefined);
  });

  it('should add datasources used in mixed mode', function() {
    var require = _.find(exported.__requires, { name: 'OtherDB' });
    expect(require).to.not.be(undefined);
  });

  it('should add panel to required', function() {
    var require = _.find(exported.__requires, { name: 'Graph' });
    expect(require.name).to.be('Graph');
    expect(require.id).to.be('graph');
    expect(require.version).to.be('1.1.0');
  });

  it('should add grafana version', function() {
    var require = _.find(exported.__requires, { name: 'Grafana' });
    expect(require.type).to.be('grafana');
    expect(require.id).to.be('grafana');
    expect(require.version).to.be('3.0.2');
  });

  it('should add constant template variables as inputs', function() {
    var input = _.find(exported.__inputs, { name: 'VAR_PREFIX' });
    expect(input.type).to.be('constant');
    expect(input.label).to.be('prefix');
    expect(input.value).to.be('collectd');
  });

  it('should templatize constant variables', function() {
    var variable = _.find(exported.templating.list, { name: 'prefix' });
    expect(variable.query).to.be('${VAR_PREFIX}');
    expect(variable.current.text).to.be('${VAR_PREFIX}');
    expect(variable.current.value).to.be('${VAR_PREFIX}');
    expect(variable.options[0].text).to.be('${VAR_PREFIX}');
    expect(variable.options[0].value).to.be('${VAR_PREFIX}');
  });
});
