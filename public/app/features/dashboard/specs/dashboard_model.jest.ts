import _ from 'lodash';
import { DashboardModel } from '../dashboard_model';
import { PanelModel } from '../panel_model';

jest.mock('app/core/services/context_srv', () => ({}));

describe('DashboardModel', function() {
  describe('when creating new dashboard model defaults only', function() {
    var model;

    beforeEach(function() {
      model = new DashboardModel({}, {});
    });

    it('should have title', function() {
      expect(model.title).toBe('No Title');
    });

    it('should have meta', function() {
      expect(model.meta.canSave).toBe(true);
      expect(model.meta.canShare).toBe(true);
    });

    it('should have default properties', function() {
      expect(model.panels.length).toBe(0);
    });
  });

  describe('when getting next panel id', function() {
    var model;

    beforeEach(function() {
      model = new DashboardModel({
        panels: [{ id: 5 }],
      });
    });

    it('should return max id + 1', function() {
      expect(model.getNextPanelId()).toBe(6);
    });
  });

  describe('getSaveModelClone', function() {
    it('should sort keys', () => {
      var model = new DashboardModel({});
      var saveModel = model.getSaveModelClone();
      var keys = _.keys(saveModel);

      expect(keys[0]).toBe('annotations');
      expect(keys[1]).toBe('autoUpdate');
    });
  });

  describe('row and panel manipulation', function() {
    var dashboard;

    beforeEach(function() {
      dashboard = new DashboardModel({});
    });

    it('adding panel should new up panel model', function() {
      dashboard.addPanel({ type: 'test', title: 'test' });

      expect(dashboard.panels[0] instanceof PanelModel).toBe(true);
    });

    it('duplicate panel should try to add to the right if there is space', function() {
      var panel = { id: 10, gridPos: { x: 0, y: 0, w: 6, h: 2 } };

      dashboard.addPanel(panel);
      dashboard.duplicatePanel(dashboard.panels[0]);

      expect(dashboard.panels[1].gridPos).toMatchObject({ x: 6, y: 0, h: 2, w: 6 });
    });

    it('duplicate panel should remove repeat data', function() {
      var panel = { id: 10, gridPos: { x: 0, y: 0, w: 6, h: 2 }, repeat: 'asd', scopedVars: { test: 'asd' } };

      dashboard.addPanel(panel);
      dashboard.duplicatePanel(dashboard.panels[0]);

      expect(dashboard.panels[1].repeat).toBe(undefined);
      expect(dashboard.panels[1].scopedVars).toBe(undefined);
    });
  });

  describe('when creating dashboard with old schema', function() {
    var model;
    var graph;
    var singlestat;
    var table;

    beforeEach(function() {
      model = new DashboardModel({
        services: { filter: { time: { from: 'now-1d', to: 'now' }, list: [{}] } },
        pulldowns: [
          { type: 'filtering', enable: true },
          { type: 'annotations', enable: true, annotations: [{ name: 'old' }] },
        ],
        panels: [
          {
            type: 'graph',
            legend: true,
            aliasYAxis: { test: 2 },
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
            targets: [{ refId: 'A' }, {}],
          },
          {
            type: 'singlestat',
            legend: true,
            thresholds: '10,20,30',
            aliasYAxis: { test: 2 },
            grid: { min: 1, max: 10 },
            targets: [{ refId: 'A' }, {}],
          },
          {
            type: 'table',
            legend: true,
            styles: [{ thresholds: ['10', '20', '30'] }, { thresholds: ['100', '200', '300'] }],
            targets: [{ refId: 'A' }, {}],
          },
        ],
      });

      graph = model.panels[0];
      singlestat = model.panels[1];
      table = model.panels[2];
    });

    it('should have title', function() {
      expect(model.title).toBe('No Title');
    });

    it('should have panel id', function() {
      expect(graph.id).toBe(1);
    });

    it('should move time and filtering list', function() {
      expect(model.time.from).toBe('now-1d');
      expect(model.templating.list[0].allFormat).toBe('glob');
    });

    it('graphite panel should change name too graph', function() {
      expect(graph.type).toBe('graph');
    });

    it('single stat panel should have two thresholds', function() {
      expect(singlestat.thresholds).toBe('20,30');
    });

    it('queries without refId should get it', function() {
      expect(graph.targets[1].refId).toBe('B');
    });

    it('update legend setting', function() {
      expect(graph.legend.show).toBe(true);
    });

    it('move aliasYAxis to series override', function() {
      expect(graph.seriesOverrides[0].alias).toBe('test');
      expect(graph.seriesOverrides[0].yaxis).toBe(2);
    });

    it('should move pulldowns to new schema', function() {
      expect(model.annotations.list[1].name).toBe('old');
    });

    it('table panel should only have two thresholds values', function() {
      expect(table.styles[0].thresholds[0]).toBe('20');
      expect(table.styles[0].thresholds[1]).toBe('30');
      expect(table.styles[1].thresholds[0]).toBe('200');
      expect(table.styles[1].thresholds[1]).toBe('300');
    });

    it('graph grid to yaxes options', function() {
      expect(graph.yaxes[0].min).toBe(1);
      expect(graph.yaxes[0].max).toBe(10);
      expect(graph.yaxes[0].format).toBe('kbyte');
      expect(graph.yaxes[0].label).toBe('left label');
      expect(graph.yaxes[0].logBase).toBe(1);
      expect(graph.yaxes[1].min).toBe(5);
      expect(graph.yaxes[1].max).toBe(15);
      expect(graph.yaxes[1].format).toBe('ms');
      expect(graph.yaxes[1].logBase).toBe(2);

      expect(graph.grid.rightMax).toBe(undefined);
      expect(graph.grid.rightLogBase).toBe(undefined);
      expect(graph.y_formats).toBe(undefined);
    });

    it('dashboard schema version should be set to latest', function() {
      expect(model.schemaVersion).toBe(16);
    });

    it('graph thresholds should be migrated', function() {
      expect(graph.thresholds.length).toBe(2);
      expect(graph.thresholds[0].op).toBe('gt');
      expect(graph.thresholds[0].value).toBe(200);
      expect(graph.thresholds[0].fillColor).toBe('yellow');
      expect(graph.thresholds[1].value).toBe(400);
      expect(graph.thresholds[1].fillColor).toBe('red');
    });
  });

  describe('Given editable false dashboard', function() {
    var model;

    beforeEach(function() {
      model = new DashboardModel({ editable: false });
    });

    it('Should set meta canEdit and canSave to false', function() {
      expect(model.meta.canSave).toBe(false);
      expect(model.meta.canEdit).toBe(false);
    });

    it('getSaveModelClone should remove meta', function() {
      var clone = model.getSaveModelClone();
      expect(clone.meta).toBe(undefined);
    });
  });

  describe('when loading dashboard with old influxdb query schema', function() {
    var model;
    var target;

    beforeEach(function() {
      model = new DashboardModel({
        panels: [
          {
            type: 'graph',
            grid: {},
            yaxes: [{}, {}],
            targets: [
              {
                alias: '$tag_datacenter $tag_source $col',
                column: 'value',
                measurement: 'logins.count',
                fields: [
                  {
                    func: 'mean',
                    name: 'value',
                    mathExpr: '*2',
                    asExpr: 'value',
                  },
                  {
                    name: 'one-minute',
                    func: 'mean',
                    mathExpr: '*3',
                    asExpr: 'one-minute',
                  },
                ],
                tags: [],
                fill: 'previous',
                function: 'mean',
                groupBy: [
                  {
                    interval: 'auto',
                    type: 'time',
                  },
                  {
                    key: 'source',
                    type: 'tag',
                  },
                  {
                    type: 'tag',
                    key: 'datacenter',
                  },
                ],
              },
            ],
          },
        ],
      });

      target = model.panels[0].targets[0];
    });

    it('should update query schema', function() {
      expect(target.fields).toBe(undefined);
      expect(target.select.length).toBe(2);
      expect(target.select[0].length).toBe(4);
      expect(target.select[0][0].type).toBe('field');
      expect(target.select[0][1].type).toBe('mean');
      expect(target.select[0][2].type).toBe('math');
      expect(target.select[0][3].type).toBe('alias');
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
          enable: true,
        },
      });
    });

    it('should add empty list', function() {
      expect(model.annotations.list.length).toBe(1);
      expect(model.templating.list.length).toBe(0);
    });

    it('should add builtin annotation query', function() {
      expect(model.annotations.list[0].builtIn).toBe(1);
      expect(model.templating.list.length).toBe(0);
    });
  });

  describe('Formatting epoch timestamp when timezone is set as utc', function() {
    var dashboard;

    beforeEach(function() {
      dashboard = new DashboardModel({ timezone: 'utc' });
    });

    it('Should format timestamp with second resolution by default', function() {
      expect(dashboard.formatDate(1234567890000)).toBe('2009-02-13 23:31:30');
    });

    it('Should format timestamp with second resolution even if second format is passed as parameter', function() {
      expect(dashboard.formatDate(1234567890007, 'YYYY-MM-DD HH:mm:ss')).toBe('2009-02-13 23:31:30');
    });

    it('Should format timestamp with millisecond resolution if format is passed as parameter', function() {
      expect(dashboard.formatDate(1234567890007, 'YYYY-MM-DD HH:mm:ss.SSS')).toBe('2009-02-13 23:31:30.007');
    });
  });

  describe('updateSubmenuVisibility with empty lists', function() {
    var model;

    beforeEach(function() {
      model = new DashboardModel({});
      model.updateSubmenuVisibility();
    });

    it('should not enable submmenu', function() {
      expect(model.meta.submenuEnabled).toBe(false);
    });
  });

  describe('updateSubmenuVisibility with annotation', function() {
    var model;

    beforeEach(function() {
      model = new DashboardModel({
        annotations: {
          list: [{}],
        },
      });
      model.updateSubmenuVisibility();
    });

    it('should enable submmenu', function() {
      expect(model.meta.submenuEnabled).toBe(true);
    });
  });

  describe('updateSubmenuVisibility with template var', function() {
    var model;

    beforeEach(function() {
      model = new DashboardModel({
        templating: {
          list: [{}],
        },
      });
      model.updateSubmenuVisibility();
    });

    it('should enable submmenu', function() {
      expect(model.meta.submenuEnabled).toBe(true);
    });
  });

  describe('updateSubmenuVisibility with hidden template var', function() {
    var model;

    beforeEach(function() {
      model = new DashboardModel({
        templating: {
          list: [{ hide: 2 }],
        },
      });
      model.updateSubmenuVisibility();
    });

    it('should not enable submmenu', function() {
      expect(model.meta.submenuEnabled).toBe(false);
    });
  });

  describe('updateSubmenuVisibility with hidden annotation toggle', function() {
    var dashboard;

    beforeEach(function() {
      dashboard = new DashboardModel({
        annotations: {
          list: [{ hide: true }],
        },
      });
      dashboard.updateSubmenuVisibility();
    });

    it('should not enable submmenu', function() {
      expect(dashboard.meta.submenuEnabled).toBe(false);
    });
  });

  describe('When collapsing row', function() {
    var dashboard;

    beforeEach(function() {
      dashboard = new DashboardModel({
        panels: [
          { id: 1, type: 'graph', gridPos: { x: 0, y: 0, w: 24, h: 2 } },
          { id: 2, type: 'row', gridPos: { x: 0, y: 2, w: 24, h: 2 } },
          { id: 3, type: 'graph', gridPos: { x: 0, y: 4, w: 12, h: 2 } },
          { id: 4, type: 'graph', gridPos: { x: 12, y: 4, w: 12, h: 2 } },
          { id: 5, type: 'row', gridPos: { x: 0, y: 6, w: 24, h: 2 } },
        ],
      });
      dashboard.toggleRow(dashboard.panels[1]);
    });

    it('should remove panels and put them inside collapsed row', function() {
      expect(dashboard.panels.length).toBe(3);
      expect(dashboard.panels[1].panels.length).toBe(2);
    });
  });

  describe('When expanding row', function() {
    var dashboard;

    beforeEach(function() {
      dashboard = new DashboardModel({
        panels: [
          { id: 1, type: 'graph', gridPos: { x: 0, y: 0, w: 24, h: 6 } },
          {
            id: 2,
            type: 'row',
            gridPos: { x: 0, y: 6, w: 24, h: 2 },
            collapsed: true,
            panels: [
              { id: 3, type: 'graph', gridPos: { x: 0, y: 2, w: 12, h: 2 } },
              { id: 4, type: 'graph', gridPos: { x: 12, y: 2, w: 12, h: 2 } },
            ],
          },
          { id: 5, type: 'graph', gridPos: { x: 0, y: 6, w: 1, h: 1 } },
        ],
      });
      dashboard.toggleRow(dashboard.panels[1]);
    });

    it('should add panels back', function() {
      expect(dashboard.panels.length).toBe(5);
    });

    it('should add them below row in array', function() {
      expect(dashboard.panels[2].id).toBe(3);
      expect(dashboard.panels[3].id).toBe(4);
    });

    it('should position them below row', function() {
      expect(dashboard.panels[2].gridPos).toMatchObject({ x: 0, y: 8, w: 12, h: 2 });
    });

    it('should move panels below down', function() {
      expect(dashboard.panels[4].gridPos).toMatchObject({ x: 0, y: 10, w: 1, h: 1 });
    });
  });
});
