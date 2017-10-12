import {describe, beforeEach, it, expect} from 'test/lib/common';

import _ from 'lodash';
import {DashboardModel} from '../DashboardModel';
import {PanelModel} from '../PanelModel';

describe('DashboardModel', function() {

  describe('when creating new dashboard model defaults only', function() {
    var model;

    beforeEach(function() {
      model = new DashboardModel({}, {});
    });

    it('should have title', function() {
      expect(model.title).to.be('No Title');
    });

    it('should have meta', function() {
      expect(model.meta.canSave).to.be(true);
      expect(model.meta.canShare).to.be(true);
    });

    it('should have default properties', function() {
      expect(model.panels.length).to.be(0);
    });
  });

  describe('when getting next panel id', function() {
    var model;

    beforeEach(function() {
      model = new DashboardModel({
        panels: [{ id: 5 }]
      });
    });

    it('should return max id + 1', function() {
      expect(model.getNextPanelId()).to.be(6);
    });
  });

  describe('getSaveModelClone', function() {
    it('should sort keys', () => {
      var model = new DashboardModel({});
      var saveModel = model.getSaveModelClone();
      var keys = _.keys(saveModel);

      expect(keys[0]).to.be('annotations');
      expect(keys[1]).to.be('autoUpdate');
    });
  });

  describe('row and panel manipulation', function() {
    var dashboard;

    beforeEach(function() {
      dashboard = new DashboardModel({});
    });

    it('adding panel should new up panel model', function() {
      dashboard.addPanel({type: 'test', title: 'test'});

      expect(dashboard.panels[0] instanceof PanelModel).to.be(true);
    });

    it('duplicate panel should try to add to the right if there is space', function() {
      var panel = {id: 10, gridPos: {x: 0, y: 0, w: 6, h: 2}};

      dashboard.addPanel(panel);
      dashboard.duplicatePanel(dashboard.panels[0]);

      expect(dashboard.panels[1].gridPos).to.eql({x: 6, y: 0, h: 2, w: 6});
    });

    it('duplicate panel should remove repeat data', function() {
      var panel = {id: 10, gridPos: {x: 0, y: 0, w: 6, h: 2}, repeat: 'asd', scopedVars: {test: 'asd'}};

      dashboard.addPanel(panel);
      dashboard.duplicatePanel(dashboard.panels[0]);

      expect(dashboard.panels[1].repeat).to.be(undefined);
      expect(dashboard.panels[1].scopedVars).to.be(undefined);
    });
  });

  describe('when creating dashboard with old schema', function() {
    var model;
    var graph;
    var singlestat;
    var table;

    beforeEach(function() {
      model = new DashboardModel({
        services: { filter: { time: { from: 'now-1d', to: 'now'}, list: [{}] }},
        pulldowns: [
          {type: 'filtering', enable: true},
          {type: 'annotations', enable: true, annotations: [{name: 'old'}]}
        ],
        panels: [
          {
            type: 'graph', legend: true, aliasYAxis: { test: 2 },
            y_formats: ['kbyte', 'ms'],
            grid: {
              min: 1,
              max: 10,
              rightMin: 5,
              rightMax: 15,
              leftLogBase: 1,
              rightLogBase: 2,
              threshold1: 200,
              threshold2: 400,
              threshold1Color: 'yellow',
              threshold2Color: 'red',
            },
            leftYAxisLabel: 'left label',
            targets: [{refId: 'A'}, {}],
          },
          {
            type: 'singlestat', legend: true, thresholds: '10,20,30', aliasYAxis: { test: 2 }, grid: { min: 1, max: 10 },
            targets: [{refId: 'A'}, {}],
          },
          {
            type: 'table', legend: true, styles: [{ thresholds: ["10", "20", "30"]}, { thresholds: ["100", "200", "300"]}],
            targets: [{refId: 'A'}, {}],
          }
        ]
      });

      graph = model.panels[0];
      singlestat = model.panels[1];
      table = model.panels[2];
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

    it('single stat panel should have two thresholds', function() {
      expect(singlestat.thresholds).to.be('20,30');
    });

    it('queries without refId should get it', function() {
      expect(graph.targets[1].refId).to.be('B');
    });

    it('update legend setting', function() {
      expect(graph.legend.show).to.be(true);
    });

    it('move aliasYAxis to series override', function() {
      expect(graph.seriesOverrides[0].alias).to.be("test");
      expect(graph.seriesOverrides[0].yaxis).to.be(2);
    });

    it('should move pulldowns to new schema', function() {
      expect(model.annotations.list[0].name).to.be('old');
    });

    it('table panel should only have two thresholds values', function() {
      expect(table.styles[0].thresholds[0]).to.be("20");
      expect(table.styles[0].thresholds[1]).to.be("30");
      expect(table.styles[1].thresholds[0]).to.be("200");
      expect(table.styles[1].thresholds[1]).to.be("300");
    });

    it('graph grid to yaxes options', function() {
      expect(graph.yaxes[0].min).to.be(1);
      expect(graph.yaxes[0].max).to.be(10);
      expect(graph.yaxes[0].format).to.be('kbyte');
      expect(graph.yaxes[0].label).to.be('left label');
      expect(graph.yaxes[0].logBase).to.be(1);
      expect(graph.yaxes[1].min).to.be(5);
      expect(graph.yaxes[1].max).to.be(15);
      expect(graph.yaxes[1].format).to.be('ms');
      expect(graph.yaxes[1].logBase).to.be(2);

      expect(graph.grid.rightMax).to.be(undefined);
      expect(graph.grid.rightLogBase).to.be(undefined);
      expect(graph.y_formats).to.be(undefined);
    });

    it('dashboard schema version should be set to latest', function() {
      expect(model.schemaVersion).to.be(16);
    });

    it('graph thresholds should be migrated', function() {
      expect(graph.thresholds.length).to.be(2);
      expect(graph.thresholds[0].op).to.be('gt');
      expect(graph.thresholds[0].value).to.be(200);
      expect(graph.thresholds[0].fillColor).to.be('yellow');
      expect(graph.thresholds[1].value).to.be(400);
      expect(graph.thresholds[1].fillColor).to.be('red');
    });
  });

  describe('Given editable false dashboard', function() {
    var model;

    beforeEach(function() {
      model = new DashboardModel({editable:  false});
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

  describe('when loading dashboard with old influxdb query schema', function() {
    var model;
    var target;

    beforeEach(function() {
      model = new DashboardModel({
        panels: [{
          type: 'graph',
          grid: {},
          yaxes: [{}, {}],
          targets: [{
            "alias": "$tag_datacenter $tag_source $col",
            "column": "value",
            "measurement": "logins.count",
            "fields": [
              {
                "func": "mean",
                "name": "value",
                "mathExpr": "*2",
                "asExpr": "value"
              },
              {
                "name": "one-minute",
                "func": "mean",
                "mathExpr": "*3",
                "asExpr": "one-minute"
              }
            ],
            "tags": [],
            "fill": "previous",
            "function": "mean",
            "groupBy": [
              {
                "interval": "auto",
                "type": "time"
              },
              {
                "key": "source",
                "type": "tag"
              },
              {
                "type": "tag",
                "key": "datacenter"
              }
            ],
          }]
        }]
      });

      target = model.panels[0].targets[0];
    });

    it('should update query schema', function() {
      expect(target.fields).to.be(undefined);
      expect(target.select.length).to.be(2);
      expect(target.select[0].length).to.be(4);
      expect(target.select[0][0].type).to.be('field');
      expect(target.select[0][1].type).to.be('mean');
      expect(target.select[0][2].type).to.be('math');
      expect(target.select[0][3].type).to.be('alias');
    });

  });

  describe('when creating dashboard model with missing list for annoations or templating', function() {
    var model;

    beforeEach(function() {
      model = new DashboardModel({
        annotations: {
          enable: true,
        },
        templating: {
          enable: true
        }
      });
    });

    it('should add empty list', function() {
      expect(model.annotations.list.length).to.be(1);
      expect(model.templating.list.length).to.be(0);
    });

    it('should add builtin annotation query', function() {
      expect(model.annotations.list[0].builtIn).to.be(1);
      expect(model.templating.list.length).to.be(0);
    });
  });

  describe('Formatting epoch timestamp when timezone is set as utc', function() {
    var dashboard;

    beforeEach(function() {
      dashboard = new DashboardModel({timezone: 'utc'});
    });

    it('Should format timestamp with second resolution by default', function() {
      expect(dashboard.formatDate(1234567890000)).to.be('2009-02-13 23:31:30');
    });

    it('Should format timestamp with second resolution even if second format is passed as parameter', function() {
      expect(dashboard.formatDate(1234567890007,'YYYY-MM-DD HH:mm:ss')).to.be('2009-02-13 23:31:30');
    });

    it('Should format timestamp with millisecond resolution if format is passed as parameter', function() {
      expect(dashboard.formatDate(1234567890007,'YYYY-MM-DD HH:mm:ss.SSS')).to.be('2009-02-13 23:31:30.007');
    });
  });

  describe('updateSubmenuVisibility with empty lists', function() {
    var model;

    beforeEach(function() {
      model = new DashboardModel({});
      model.updateSubmenuVisibility();
    });

    it('should not enable submmenu', function() {
      expect(model.meta.submenuEnabled).to.be(false);
    });
  });

  describe('updateSubmenuVisibility with annotation', function() {
    var model;

    beforeEach(function() {
      model = new DashboardModel({
        annotations: {
          list: [{}]
        }
      });
      model.updateSubmenuVisibility();
    });

    it('should enable submmenu', function() {
      expect(model.meta.submenuEnabled).to.be(true);
    });
  });

  describe('updateSubmenuVisibility with template var', function() {
    var model;

    beforeEach(function() {
      model = new DashboardModel({
        templating: {
          list: [{}]
        }
      });
      model.updateSubmenuVisibility();
    });

    it('should enable submmenu', function() {
      expect(model.meta.submenuEnabled).to.be(true);
    });
  });

  describe('updateSubmenuVisibility with hidden template var', function() {
    var model;

    beforeEach(function() {
      model = new DashboardModel({
        templating: {
          list: [{hide: 2}]
        }
      });
      model.updateSubmenuVisibility();
    });

    it('should not enable submmenu', function() {
      expect(model.meta.submenuEnabled).to.be(false);
    });
  });

  describe('updateSubmenuVisibility with hidden annotation toggle', function() {
    var model;

    beforeEach(function() {
      model = new DashboardModel({
        annotations: {
          list: [{hide: true}]
        }
      });
      model.updateSubmenuVisibility();
    });

    it('should not enable submmenu', function() {
      expect(model.meta.submenuEnabled).to.be(false);
    });
  });

});
