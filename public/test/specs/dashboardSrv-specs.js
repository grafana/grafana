define([
  'app/features/dashboard/dashboardSrv'
], function() {
  'use strict';

  describe('dashboardSrv', function() {
    var _dashboardSrv;

    beforeEach(module('grafana.services'));

    beforeEach(inject(function(dashboardSrv) {
      _dashboardSrv = dashboardSrv;
    }));

    describe('when creating new dashboard with defaults only', function() {
      var model;

      beforeEach(function() {
        model = _dashboardSrv.create({}, {});
      });

      it('should have title', function() {
        expect(model.title).to.be('No Title');
      });

      it('should have meta', function() {
        expect(model.meta.canSave).to.be(true);
        expect(model.meta.canShare).to.be(true);
      });

      it('should have default properties', function() {
        expect(model.rows.length).to.be(0);
      });
    });

    describe('when getting next panel id', function() {
      var model;

      beforeEach(function() {
        model = _dashboardSrv.create({
          rows: [{ panels: [{ id: 5 }]}]
        });
      });

      it('should return max id + 1', function() {
        expect(model.getNextPanelId()).to.be(6);
      });
    });

    describe('addDataQueryTo', function() {
      var dashboard, panel;

      beforeEach(function() {
        panel = {targets:[]};
        dashboard = _dashboardSrv.create({});
        dashboard.rows.push({panels: [panel]});
      });

      it('should add target', function() {
        dashboard.addDataQueryTo(panel);
        expect(panel.targets.length).to.be(1);
      });

      it('should set refId', function() {
        dashboard.addDataQueryTo(panel);
        expect(panel.targets[0].refId).to.be('A');
      });

      it('should set refId to first available letter', function() {
        panel.targets = [{refId: 'A'}];
        dashboard.addDataQueryTo(panel);
        expect(panel.targets[1].refId).to.be('B');
      });

      it('duplicate should get unique refId', function() {
        panel.targets = [{refId: 'A'}];
        dashboard.duplicateDataQuery(panel, panel.targets[0]);
        expect(panel.targets[1].refId).to.be('B');
      });

    });

    describe('row and panel manipulation', function() {
      var dashboard;

      beforeEach(function() {
        dashboard = _dashboardSrv.create({});
      });

      it('row span should sum spans', function() {
        var spanLeft = dashboard.rowSpan({ panels: [{ span: 2 }, { span: 3 }] });
        expect(spanLeft).to.be(5);
      });

      it('adding default should split span in half', function() {
        dashboard.rows = [{ panels: [{ span: 12, id: 7 }] }];
        dashboard.addPanel({span: 4}, dashboard.rows[0]);

        expect(dashboard.rows[0].panels[0].span).to.be(6);
        expect(dashboard.rows[0].panels[1].span).to.be(6);
        expect(dashboard.rows[0].panels[1].id).to.be(8);
      });

      it('duplicate panel should try to add it to same row', function() {
        var panel = { span: 4, attr: '123', id: 10 };
        dashboard.rows = [{ panels: [panel] }];
        dashboard.duplicatePanel(panel, dashboard.rows[0]);

        expect(dashboard.rows[0].panels[0].span).to.be(4);
        expect(dashboard.rows[0].panels[1].span).to.be(4);
        expect(dashboard.rows[0].panels[1].attr).to.be('123');
        expect(dashboard.rows[0].panels[1].id).to.be(11);
      });

      it('duplicate panel should remove repeat data', function() {
        var panel = { span: 4, attr: '123', id: 10, repeat: 'asd', scopedVars: { test: 'asd' }};
        dashboard.rows = [{ panels: [panel] }];
        dashboard.duplicatePanel(panel, dashboard.rows[0]);

        expect(dashboard.rows[0].panels[1].repeat).to.be(undefined);
        expect(dashboard.rows[0].panels[1].scopedVars).to.be(undefined);
      });

    });

    describe('when creating dashboard with editable false', function() {
      var model;

      beforeEach(function() {
        model = _dashboardSrv.create({
          editable: false
        });
      });

      it('should set editable false', function() {
        expect(model.editable).to.be(false);
      });

    });

    describe('when creating dashboard with old schema', function() {
      var model;
      var graph;

      beforeEach(function() {
        model = _dashboardSrv.create({
          services: { filter: { time: { from: 'now-1d', to: 'now'}, list: [{}] }},
          pulldowns: [
            {type: 'filtering', enable: true},
            {type: 'annotations', enable: true, annotations: [{name: 'old'}]}
          ],
          rows: [
            {
              panels: [
                {
                  type: 'graphite', legend: true, aliasYAxis: { test: 2 }, grid: { min: 1, max: 10 },
                  targets: [{refId: 'A'}, {}],
                }
              ]
            }
          ]
        });

        graph = model.rows[0].panels[0];
      });

      it('should have title', function() {
        expect(model.title).to.be('No Title');
      });

      it('should have panel id', function() {
        expect(graph.id).to.be(1);
      });

      it('should move time and filtering list', function() {
        expect(model.time.from).to.be('now-1d');
        expect(model.templating.list[0].allFormat).to.be('glob');
      });

      it('graphite panel should change name too graph', function() {
        expect(graph.type).to.be('graph');
      });

      it('queries without refId should get it', function() {
        expect(graph.targets[1].refId).to.be('B');
      });

      it('update legend setting', function() {
        expect(graph.legend.show).to.be(true);
      });

      it('update grid options', function() {
        expect(graph.grid.leftMin).to.be(1);
        expect(graph.grid.leftMax).to.be(10);
      });

      it('move aliasYAxis to series override', function() {
        expect(graph.seriesOverrides[0].alias).to.be("test");
        expect(graph.seriesOverrides[0].yaxis).to.be(2);
      });

      it('should move pulldowns to new schema', function() {
        expect(model.annotations.list[0].name).to.be('old');
      });

      it('dashboard schema version should be set to latest', function() {
        expect(model.schemaVersion).to.be(7);
      });

    });

    describe('when creating dashboard model with missing list for annoations or templating', function() {
      var model;

      beforeEach(function() {
        model = _dashboardSrv.create({
          annotations: {
            enable: true,
          },
          templating: {
            enable: true
          }
        });
      });

      it('should add empty list', function() {
        expect(model.annotations.list.length).to.be(0);
        expect(model.templating.list.length).to.be(0);
      });
    });

    describe('Given editable false dashboard', function() {
      var model;

      beforeEach(function() {
        model = _dashboardSrv.create({
          editable:  false,
        });
      });

      it('Should set meta canEdit and canSave to false', function() {
        expect(model.meta.canSave).to.be(false);
        expect(model.meta.canEdit).to.be(false);
      });

      it('getSaveModelClone should remove meta', function() {
        var clone = model.getSaveModelClone();
        expect(clone.meta).to.be(undefined);
      });
    });

    describe('Formatting epoch timestamp', function() {

      var dashboard;

      beforeEach(function() {
        dashboard = _dashboardSrv.create({});
      });

      it('Should format timestamp with second resolution by default', function() {
        expect(dashboard.formatDate(1234567890000)).to.be('2009-02-13 15:31:30');
      });

      it('Should format timestamp with millisecond resolution if format is passed as parameter', function() {
        expect(dashboard.formatDate(1234567890007,'YYYY-MM-DD HH:mm:ss.SSS')).to.be('2009-02-13 15:31:30.007');
      });
    });

  });
});
