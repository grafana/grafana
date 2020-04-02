import _ from 'lodash';
import { DashboardModel } from '../state/DashboardModel';
import { PanelModel } from '../state/PanelModel';

jest.mock('app/core/services/context_srv', () => ({}));

describe('DashboardModel', () => {
  describe('when creating new dashboard model defaults only', () => {
    let model: DashboardModel;

    beforeEach(() => {
      model = new DashboardModel({}, {});
    });

    it('should have title', () => {
      expect(model.title).toBe('No Title');
    });

    it('should have meta', () => {
      expect(model.meta.canSave).toBe(true);
      expect(model.meta.canShare).toBe(true);
    });

    it('should have default properties', () => {
      expect(model.panels.length).toBe(0);
    });
  });

  describe('when getting next panel id', () => {
    let model: DashboardModel;

    beforeEach(() => {
      model = new DashboardModel({
        panels: [{ id: 5 }],
      });
    });

    it('should return max id + 1', () => {
      expect(model.getNextPanelId()).toBe(6);
    });
  });

  describe('getSaveModelClone', () => {
    it('should sort keys', () => {
      const model = new DashboardModel({});
      const saveModel = model.getSaveModelClone();
      const keys = _.keys(saveModel);

      expect(keys[0]).toBe('annotations');
      expect(keys[1]).toBe('autoUpdate');
    });

    it('should remove add panel panels', () => {
      const model = new DashboardModel({});
      model.addPanel({
        type: 'add-panel',
      });
      model.addPanel({
        type: 'graph',
      });
      model.addPanel({
        type: 'add-panel',
      });
      const saveModel = model.getSaveModelClone();
      const panels = saveModel.panels;

      expect(panels.length).toBe(1);
    });
  });

  describe('row and panel manipulation', () => {
    let dashboard: DashboardModel;

    beforeEach(() => {
      dashboard = new DashboardModel({});
    });

    it('adding panel should new up panel model', () => {
      dashboard.addPanel({ type: 'test', title: 'test' });

      expect(dashboard.panels[0] instanceof PanelModel).toBe(true);
    });

    it('duplicate panel should try to add to the right if there is space', () => {
      const panel = { id: 10, gridPos: { x: 0, y: 0, w: 6, h: 2 } };

      dashboard.addPanel(panel);
      dashboard.duplicatePanel(dashboard.panels[0]);

      expect(dashboard.panels[1].gridPos).toMatchObject({
        x: 6,
        y: 0,
        h: 2,
        w: 6,
      });
    });

    it('duplicate panel should remove repeat data', () => {
      const panel = {
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

  describe('Given editable false dashboard', () => {
    let model: DashboardModel;

    beforeEach(() => {
      model = new DashboardModel({ editable: false });
    });

    it('Should set meta canEdit and canSave to false', () => {
      expect(model.meta.canSave).toBe(false);
      expect(model.meta.canEdit).toBe(false);
    });

    it('getSaveModelClone should remove meta', () => {
      const clone = model.getSaveModelClone();
      expect(clone.meta).toBe(undefined);
    });
  });

  describe('when loading dashboard with old influxdb query schema', () => {
    let model: DashboardModel;
    let target: any;

    beforeEach(() => {
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

    it('should update query schema', () => {
      expect(target.fields).toBe(undefined);
      expect(target.select.length).toBe(2);
      expect(target.select[0].length).toBe(4);
      expect(target.select[0][0].type).toBe('field');
      expect(target.select[0][1].type).toBe('mean');
      expect(target.select[0][2].type).toBe('math');
      expect(target.select[0][3].type).toBe('alias');
    });
  });

  describe('when creating dashboard model with missing list for annoations or templating', () => {
    let model: DashboardModel;

    beforeEach(() => {
      model = new DashboardModel({
        annotations: {
          enable: true,
        },
        templating: {
          enable: true,
        },
      });
    });

    it('should add empty list', () => {
      expect(model.annotations.list.length).toBe(1);
      expect(model.templating.list.length).toBe(0);
    });

    it('should add builtin annotation query', () => {
      expect(model.annotations.list[0].builtIn).toBe(1);
      expect(model.templating.list.length).toBe(0);
    });
  });

  describe('Formatting epoch timestamp when timezone is set as utc', () => {
    let dashboard: DashboardModel;

    beforeEach(() => {
      dashboard = new DashboardModel({ timezone: 'utc' });
    });

    it('Should format timestamp with second resolution by default', () => {
      expect(dashboard.formatDate(1234567890000)).toBe('2009-02-13 23:31:30');
    });

    it('Should format timestamp with second resolution even if second format is passed as parameter', () => {
      expect(dashboard.formatDate(1234567890007, 'YYYY-MM-DD HH:mm:ss')).toBe('2009-02-13 23:31:30');
    });

    it('Should format timestamp with millisecond resolution if format is passed as parameter', () => {
      expect(dashboard.formatDate(1234567890007, 'YYYY-MM-DD HH:mm:ss.SSS')).toBe('2009-02-13 23:31:30.007');
    });
  });

  describe('updateSubmenuVisibility with empty lists', () => {
    let model: DashboardModel;

    beforeEach(() => {
      model = new DashboardModel({});
      model.updateSubmenuVisibility();
    });

    it('should not enable submmenu', () => {
      expect(model.meta.submenuEnabled).toBe(false);
    });
  });

  describe('updateSubmenuVisibility with annotation', () => {
    let model: DashboardModel;

    beforeEach(() => {
      model = new DashboardModel({
        annotations: {
          list: [{}],
        },
      });
      model.updateSubmenuVisibility();
    });

    it('should enable submmenu', () => {
      expect(model.meta.submenuEnabled).toBe(true);
    });
  });

  describe('updateSubmenuVisibility with template var', () => {
    let model: DashboardModel;

    beforeEach(() => {
      model = new DashboardModel({
        templating: {
          list: [{}],
        },
      });
      model.updateSubmenuVisibility();
    });

    it('should enable submmenu', () => {
      expect(model.meta.submenuEnabled).toBe(true);
    });
  });

  describe('updateSubmenuVisibility with hidden template var', () => {
    let model: DashboardModel;

    beforeEach(() => {
      model = new DashboardModel({
        templating: {
          list: [{ hide: 2 }],
        },
      });
      model.updateSubmenuVisibility();
    });

    it('should not enable submmenu', () => {
      expect(model.meta.submenuEnabled).toBe(false);
    });
  });

  describe('updateSubmenuVisibility with hidden annotation toggle', () => {
    let dashboard: DashboardModel;

    beforeEach(() => {
      dashboard = new DashboardModel({
        annotations: {
          list: [{ hide: true }],
        },
      });
      dashboard.updateSubmenuVisibility();
    });

    it('should not enable submmenu', () => {
      expect(dashboard.meta.submenuEnabled).toBe(false);
    });
  });

  describe('When collapsing row', () => {
    let dashboard: DashboardModel;

    beforeEach(() => {
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

    it('should remove panels and put them inside collapsed row', () => {
      expect(dashboard.panels.length).toBe(3);
      expect(dashboard.panels[1].panels.length).toBe(2);
    });

    describe('and when removing row and its panels', () => {
      beforeEach(() => {
        dashboard.removeRow(dashboard.panels[1], true);
      });

      it('should remove row and its panels', () => {
        expect(dashboard.panels.length).toBe(2);
      });
    });

    describe('and when removing only the row', () => {
      beforeEach(() => {
        dashboard.removeRow(dashboard.panels[1], false);
      });

      it('should only remove row', () => {
        expect(dashboard.panels.length).toBe(4);
      });
    });
  });

  describe('When expanding row', () => {
    let dashboard: DashboardModel;

    beforeEach(() => {
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

    it('should add panels back', () => {
      expect(dashboard.panels.length).toBe(5);
    });

    it('should add them below row in array', () => {
      expect(dashboard.panels[2].id).toBe(3);
      expect(dashboard.panels[3].id).toBe(4);
    });

    it('should position them below row', () => {
      expect(dashboard.panels[2].gridPos).toMatchObject({
        x: 0,
        y: 7,
        w: 12,
        h: 2,
      });
    });

    it('should move panels below down', () => {
      expect(dashboard.panels[4].gridPos).toMatchObject({
        x: 0,
        y: 9,
        w: 1,
        h: 1,
      });
    });

    describe('and when removing row and its panels', () => {
      beforeEach(() => {
        dashboard.removeRow(dashboard.panels[1], true);
      });

      it('should remove row and its panels', () => {
        expect(dashboard.panels.length).toBe(2);
      });
    });

    describe('and when removing only the row', () => {
      beforeEach(() => {
        dashboard.removeRow(dashboard.panels[1], false);
      });

      it('should only remove row', () => {
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
      const options = { saveTimerange: false };
      const saveModel = model.getSaveModelClone(options);

      expect(saveModel.time.from).toBe('now-6h');
      expect(saveModel.time.to).toBe('now');
    });

    it('getSaveModelClone should return updated time when saveTimerange=true', () => {
      const options = { saveTimerange: true };
      const saveModel = model.getSaveModelClone(options);

      expect(saveModel.time.from).toBe('now-3h');
      expect(saveModel.time.to).toBe('now-1h');
    });

    it('hasTimeChanged should be false when reset original time', () => {
      model.resetOriginalTime();
      expect(model.hasTimeChanged()).toBeFalsy();
    });

    it('getSaveModelClone should return original time when saveTimerange=false', () => {
      const options = { saveTimerange: false };
      const saveModel = model.getSaveModelClone(options);

      expect(saveModel.time.from).toBe('now-6h');
      expect(saveModel.time.to).toBe('now');
    });

    it('getSaveModelClone should return updated time when saveTimerange=true', () => {
      const options = { saveTimerange: true };
      const saveModel = model.getSaveModelClone(options);

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

      const options = { saveVariables: false };
      const saveModel = model.getSaveModelClone(options);

      expect(saveModel.templating.list[0].current.text).toBe('server_001');
    });

    it('getSaveModelClone should return updated variable when saveVariables=true', () => {
      model.templating.list[0].current.text = 'server_002';

      const options = { saveVariables: true };
      const saveModel = model.getSaveModelClone(options);

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

      const options = { saveVariables: false };
      const saveModel = model.getSaveModelClone(options);

      expect(saveModel.templating.list[0].filters[0].value).toBe('server 20');
    });

    it('getSaveModelClone should return updated variable when saveVariables=true', () => {
      model.templating.list[0].filters[0].value = 'server 1';

      const options = { saveVariables: true };
      const saveModel = model.getSaveModelClone(options);

      expect(saveModel.templating.list[0].filters[0].value).toBe('server 1');
    });
  });

  describe('Given a dashboard with one panel legend on and two off', () => {
    let model: DashboardModel;

    beforeEach(() => {
      const data = {
        panels: [
          { id: 1, type: 'graph', gridPos: { x: 0, y: 0, w: 24, h: 2 }, legend: { show: true } },
          { id: 3, type: 'graph', gridPos: { x: 0, y: 4, w: 12, h: 2 }, legend: { show: false } },
          { id: 4, type: 'graph', gridPos: { x: 12, y: 4, w: 12, h: 2 }, legend: { show: false } },
        ],
      };
      model = new DashboardModel(data);
    });

    it('toggleLegendsForAll should toggle all legends on on first execution', () => {
      model.toggleLegendsForAll();
      const legendsOn = model.panels.filter(panel => panel.legend!.show === true);
      expect(legendsOn.length).toBe(3);
    });

    it('toggleLegendsForAll should toggle all legends off on second execution', () => {
      model.toggleLegendsForAll();
      model.toggleLegendsForAll();
      const legendsOn = model.panels.filter(panel => panel.legend!.show === true);
      expect(legendsOn.length).toBe(0);
    });
  });
});
