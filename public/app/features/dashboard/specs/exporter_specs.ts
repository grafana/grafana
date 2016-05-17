import {describe, beforeEach, it, sinon, expect, angularMocks} from 'test/lib/common';

import _ from 'lodash';
import config from 'app/core/config';
import {DashboardExporter} from '../export/exporter';

describe.only('given dashboard with repeated panels', function() {
  var dash, exported;

  beforeEach(done => {
    dash = {
      rows: [],
      templating: { list: [] }
    };
    dash.templating.list.push({
      name: 'apps',
      current: {},
      options: []
    });

    dash.rows.push({
      repeat: 'test',
      panels: [
        {id: 2, repeat: 'apps', datasource: 'gfdb', type: 'graph'},
        {id: 2, repeat: null, repeatPanelId: 2},
      ]
    });
    dash.rows.push({
      repeat: null,
      repeatRowId: 1
    });

    var datasourceSrvStub = {
      get: sinon.stub().returns(Promise.resolve({
        name: 'gfdb',
        meta: {id: "testdb", info: {version: "1.2.1"}, name: "TestDB"}
      }))
    };

    config.panels['graph'] = {
      id: "graph",
      name: "Graph",
      info: {version: "1.1.0"}
    };

    var exporter = new DashboardExporter(datasourceSrvStub);
    exporter.makeExportable(dash).then(clean => {
      exported = clean;
      done();
    });
  });

  it('exported dashboard should not contain repeated panels', function() {
    expect(exported.rows[0].panels.length).to.be(1);
  });

  it('exported dashboard should not contain repeated rows', function() {
    expect(exported.rows.length).to.be(1);
  });

  it('should replace datasource refs', function() {
    var panel = exported.rows[0].panels[0];
    expect(panel.datasource).to.be("${DS_GFDB}");
  });

  it('should add datasource as input', function() {
    expect(exported.__inputs[0].name).to.be("DS_GFDB");
    expect(exported.__inputs[0].pluginId).to.be("testdb");
    expect(exported.__inputs[0].type).to.be("datasource");
  });

  it('should add datasource to required', function() {
    var require = _.findWhere(exported.__requires, {name: 'TestDB'});
    expect(require.name).to.be("TestDB");
    expect(require.id).to.be("testdb");
    expect(require.type).to.be("datasource");
    expect(require.version).to.be("1.2.1");
  });

  it('should add panel to required', function() {
    var require = _.findWhere(exported.__requires, {name: 'Graph'});
    expect(require.name).to.be("Graph");
    expect(require.id).to.be("graph");
    expect(require.version).to.be("1.1.0");
  });

});

