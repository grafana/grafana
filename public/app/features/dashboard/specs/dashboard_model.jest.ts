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

    it('should remove add panel panels', () => {
      var model = new DashboardModel({});
      model.addPanel({
        type: 'add-panel',
      });
      model.addPanel({
        type: 'graph',
      });
      model.addPanel({
        type: 'add-panel',
      });
      var saveModel = model.getSaveModelClone();
      var panels = saveModel.panels;

      expect(panels.length).toBe(1);
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

      expect(dashboard.panels[1].gridPos).toMatchObject({
        x: 6,
        y: 0,
        h: 2,
        w: 6,
      });
    });

    it('duplicate panel should remove repeat data', function() {
      var panel = {
        id: 10,
        gridPos: { x: 0, y: 0, w: 6, h: 2 },
        repeat: 'asd',
        scopedVars: { test: 'asd' },
      };

      dashboard.addPanel(panel);
      dashboard.duplicatePanel(dashboard.panels[0]);

      expect(dashboard.panels[1].repeat).toBe(undefined);
      expect(dashboard.panels[1].scopedVars).toBe(undefined);
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

    describe('and when removing row and its panels', function() {
      beforeEach(function() {
        dashboard.removeRow(dashboard.panels[1], true);
      });

      it('should remove row and its panels', function() {
        expect(dashboard.panels.length).toBe(2);
      });
    });

    describe('and when removing only the row', function() {
      beforeEach(function() {
        dashboard.removeRow(dashboard.panels[1], false);
      });

      it('should only remove row', function() {
        expect(dashboard.panels.length).toBe(4);
      });
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
            gridPos: { x: 0, y: 6, w: 24, h: 1 },
            collapsed: true,
            panels: [
              { id: 3, type: 'graph', gridPos: { x: 0, y: 7, w: 12, h: 2 } },
              { id: 4, type: 'graph', gridPos: { x: 12, y: 7, w: 12, h: 2 } },
            ],
          },
          { id: 5, type: 'row', gridPos: { x: 0, y: 7, w: 1, h: 1 } },
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
      expect(dashboard.panels[2].gridPos).toMatchObject({
        x: 0,
        y: 7,
        w: 12,
        h: 2,
      });
    });

    it('should move panels below down', function() {
      expect(dashboard.panels[4].gridPos).toMatchObject({
        x: 0,
        y: 9,
        w: 1,
        h: 1,
      });
    });

    describe('and when removing row and its panels', function() {
      beforeEach(function() {
        dashboard.removeRow(dashboard.panels[1], true);
      });

      it('should remove row and its panels', function() {
        expect(dashboard.panels.length).toBe(2);
      });
    });

    describe('and when removing only the row', function() {
      beforeEach(function() {
        dashboard.removeRow(dashboard.panels[1], false);
      });

      it('should only remove row', function() {
        expect(dashboard.panels.length).toBe(4);
      });
    });
  });

  describe('Given model with time', () => {
    let model: DashboardModel;

    beforeEach(() => {
      model = new DashboardModel({
        time: {
          from: 'now-6h',
          to: 'now',
        },
      });
      expect(model.hasTimeChanged()).toBeFalsy();
      model.time = {
        from: 'now-3h',
        to: 'now-1h',
      };
    });

    it('hasTimeChanged should be true', () => {
      expect(model.hasTimeChanged()).toBeTruthy();
    });

    it('getSaveModelClone should return original time when saveTimerange=false', () => {
      let options = { saveTimerange: false };
      let saveModel = model.getSaveModelClone(options);

      expect(saveModel.time.from).toBe('now-6h');
      expect(saveModel.time.to).toBe('now');
    });

    it('getSaveModelClone should return updated time when saveTimerange=true', () => {
      let options = { saveTimerange: true };
      let saveModel = model.getSaveModelClone(options);

      expect(saveModel.time.from).toBe('now-3h');
      expect(saveModel.time.to).toBe('now-1h');
    });

    it('hasTimeChanged should be false when reset original time', () => {
      model.resetOriginalTime();
      expect(model.hasTimeChanged()).toBeFalsy();
    });

    it('getSaveModelClone should return original time when saveTimerange=false', () => {
      let options = { saveTimerange: false };
      let saveModel = model.getSaveModelClone(options);

      expect(saveModel.time.from).toBe('now-6h');
      expect(saveModel.time.to).toBe('now');
    });

    it('getSaveModelClone should return updated time when saveTimerange=true', () => {
      let options = { saveTimerange: true };
      let saveModel = model.getSaveModelClone(options);

      expect(saveModel.time.from).toBe('now-3h');
      expect(saveModel.time.to).toBe('now-1h');
    });
  });

  describe('Given model with template variable of type query', () => {
    let model: DashboardModel;

    beforeEach(() => {
      model = new DashboardModel({
        templating: {
          list: [
            {
              name: 'Server',
              type: 'query',
              current: {
                selected: true,
                text: 'server_001',
                value: 'server_001',
              },
            },
          ],
        },
      });
      expect(model.hasVariableValuesChanged()).toBeFalsy();
    });

    it('hasVariableValuesChanged should be false when adding a template variable', () => {
      model.templating.list.push({
        name: 'Server2',
        type: 'query',
        current: {
          selected: true,
          text: 'server_002',
          value: 'server_002',
        },
      });
      expect(model.hasVariableValuesChanged()).toBeFalsy();
    });

    it('hasVariableValuesChanged should be false when removing existing template variable', () => {
      model.templating.list = [];
      expect(model.hasVariableValuesChanged()).toBeFalsy();
    });

    it('hasVariableValuesChanged should be true when changing value of template variable', () => {
      model.templating.list[0].current.text = 'server_002';
      expect(model.hasVariableValuesChanged()).toBeTruthy();
    });

    it('getSaveModelClone should return original variable when saveVariables=false', () => {
      model.templating.list[0].current.text = 'server_002';

      let options = { saveVariables: false };
      let saveModel = model.getSaveModelClone(options);

      expect(saveModel.templating.list[0].current.text).toBe('server_001');
    });

    it('getSaveModelClone should return updated variable when saveVariables=true', () => {
      model.templating.list[0].current.text = 'server_002';

      let options = { saveVariables: true };
      let saveModel = model.getSaveModelClone(options);

      expect(saveModel.templating.list[0].current.text).toBe('server_002');
    });
  });

  describe('Given model with template variable of type adhoc', () => {
    let model: DashboardModel;

    beforeEach(() => {
      model = new DashboardModel({
        templating: {
          list: [
            {
              name: 'Filter',
              type: 'adhoc',
              filters: [
                {
                  key: '@hostname',
                  operator: '=',
                  value: 'server 20',
                },
              ],
            },
          ],
        },
      });
      expect(model.hasVariableValuesChanged()).toBeFalsy();
    });

    it('hasVariableValuesChanged should be false when adding a template variable', () => {
      model.templating.list.push({
        name: 'Filter',
        type: 'adhoc',
        filters: [
          {
            key: '@hostname',
            operator: '=',
            value: 'server 1',
          },
        ],
      });
      expect(model.hasVariableValuesChanged()).toBeFalsy();
    });

    it('hasVariableValuesChanged should be false when removing existing template variable', () => {
      model.templating.list = [];
      expect(model.hasVariableValuesChanged()).toBeFalsy();
    });

    it('hasVariableValuesChanged should be true when changing value of filter', () => {
      model.templating.list[0].filters[0].value = 'server 1';
      expect(model.hasVariableValuesChanged()).toBeTruthy();
    });

    it('hasVariableValuesChanged should be true when adding an additional condition', () => {
      model.templating.list[0].filters[0].condition = 'AND';
      model.templating.list[0].filters[1] = {
        key: '@metric',
        operator: '=',
        value: 'logins.count',
      };
      expect(model.hasVariableValuesChanged()).toBeTruthy();
    });

    it('getSaveModelClone should return original variable when saveVariables=false', () => {
      model.templating.list[0].filters[0].value = 'server 1';

      let options = { saveVariables: false };
      let saveModel = model.getSaveModelClone(options);

      expect(saveModel.templating.list[0].filters[0].value).toBe('server 20');
    });

    it('getSaveModelClone should return updated variable when saveVariables=true', () => {
      model.templating.list[0].filters[0].value = 'server 1';

      let options = { saveVariables: true };
      let saveModel = model.getSaveModelClone(options);

      expect(saveModel.templating.list[0].filters[0].value).toBe('server 1');
    });
  });
});
