import {describe, beforeEach, it, sinon, expect, angularMocks} from 'test/lib/common';

import {DashboardExporter} from '../exporter';

describe('given dashboard with repeated panels', function() {
  var dash, exported;

  beforeEach((done) => {
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
        {id: 2, repeat: 'apps', datasource: 'gfdb'},
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
        meta: {id: "testdb"}
      }))
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

});

