import { keys as _keys } from 'lodash';

import { VariableHide } from '@grafana/data';
import { defaultVariableModel } from '@grafana/schema';
import { contextSrv } from 'app/core/services/context_srv';

import { getDashboardModel } from '../../../../test/helpers/getDashboardModel';
import { variableAdapters } from '../../variables/adapters';
import { createAdHocVariableAdapter } from '../../variables/adhoc/adapter';
import { createCustomVariableAdapter } from '../../variables/custom/adapter';
import { createQueryVariableAdapter } from '../../variables/query/adapter';
import { setTimeSrv, TimeSrv } from '../services/TimeSrv';
import { DashboardModel } from '../state/DashboardModel';
import { PanelModel } from '../state/PanelModel';

import {
  createAnnotationJSONFixture,
  createDashboardModelFixture,
  createPanelJSONFixture,
  createVariableJSONFixture,
} from './__fixtures__/dashboardFixtures';

jest.mock('app/core/services/context_srv');

const mockContextSrv = jest.mocked(contextSrv);

variableAdapters.setInit(() => [
  createQueryVariableAdapter(),
  createAdHocVariableAdapter(),
  createCustomVariableAdapter(),
]);

describe('DashboardModel', () => {
  describe('when creating new dashboard model defaults only', () => {
    let model: DashboardModel;

    beforeEach(() => {
      model = createDashboardModelFixture();
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
      model = createDashboardModelFixture({
        panels: [createPanelJSONFixture({ id: 5 })],
      });
    });

    it('should return max id + 1', () => {
      expect(model.getNextPanelId()).toBe(6);
    });
  });

  describe('getSaveModelClone', () => {
    it('should sort keys', () => {
      const model = createDashboardModelFixture();

      const saveModel = model.getSaveModelClone();
      const keys = _keys(saveModel);

      expect(keys[0]).toBe('annotations');
      expect(keys[1]).toBe('editable');
    });

    it('should remove add panel panels', () => {
      const model = createDashboardModelFixture();
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

    it('should save model in edit mode', () => {
      const model = createDashboardModelFixture();
      model.addPanel({ type: 'graph' });

      const panel = model.initEditPanel(model.panels[0]);
      panel.title = 'updated';

      const saveModel = model.getSaveModelClone();
      const savedPanel = saveModel.panels[0];

      expect(savedPanel.title).toBe('updated');
      expect(savedPanel.id).toBe(model.panels[0].id);
    });
  });

  describe('row and panel manipulation', () => {
    let dashboard: DashboardModel;

    beforeEach(() => {
      dashboard = createDashboardModelFixture();
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
      model = createDashboardModelFixture({ editable: false });
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
      model = createDashboardModelFixture({
        schemaVersion: 1,
        panels: [
          createPanelJSONFixture({
            type: 'graph',
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
          }),
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
      model = createDashboardModelFixture({
        annotations: {},
        templating: {},
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
      dashboard = createDashboardModelFixture({ timezone: 'utc' });
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

  describe('isSubMenuVisible with empty lists', () => {
    let model: DashboardModel;

    beforeEach(() => {
      model = createDashboardModelFixture();
    });

    it('should not show submenu', () => {
      expect(model.isSubMenuVisible()).toBe(false);
    });
  });

  describe('isSubMenuVisible with annotation', () => {
    let model: DashboardModel;

    beforeEach(() => {
      model = createDashboardModelFixture({
        schemaVersion: 30,
        annotations: {
          list: [
            {
              datasource: { uid: 'fake-uid', type: 'prometheus' },
              showIn: 0,
              name: 'Fake annotation',
              type: 'dashboard',
              iconColor: 'rgba(0, 211, 255, 1)',
              enable: true,
              hide: false,
              builtIn: 0,
            },
          ],
        },
      });
    });

    it('should show submmenu', () => {
      expect(model.isSubMenuVisible()).toBe(true);
    });
  });

  describe('isSubMenuVisible with template var', () => {
    let model: DashboardModel;

    beforeEach(() => {
      model = createDashboardModelFixture(
        {
          templating: {
            list: [createVariableJSONFixture({})],
          },
        },
        {},
        // getVariablesFromState stub to return a variable
        jest.fn().mockImplementation(() => [{}])
      );
    });

    it('should enable submmenu', () => {
      expect(model.isSubMenuVisible()).toBe(true);
    });
  });

  describe('isSubMenuVisible with hidden template var', () => {
    let model: DashboardModel;

    beforeEach(() => {
      model = createDashboardModelFixture({
        templating: {
          list: [
            {
              ...defaultVariableModel,
              hide: VariableHide.hideVariable,
            },
          ],
        },
      });
    });

    it('should not enable submmenu', () => {
      expect(model.isSubMenuVisible()).toBe(false);
    });
  });

  describe('isSubMenuVisible with hidden annotation toggle', () => {
    let dashboard: DashboardModel;

    beforeEach(() => {
      dashboard = createDashboardModelFixture({
        annotations: {
          list: [createAnnotationJSONFixture({ hide: true })],
        },
      });
    });

    it('should not enable submmenu', () => {
      expect(dashboard.isSubMenuVisible()).toBe(false);
    });
  });

  describe('When collapsing row', () => {
    let dashboard: DashboardModel;

    beforeEach(() => {
      dashboard = createDashboardModelFixture({
        panels: [
          createPanelJSONFixture({ id: 1, type: 'graph', gridPos: { x: 0, y: 0, w: 24, h: 2 } }),
          createPanelJSONFixture({ id: 2, type: 'row', gridPos: { x: 0, y: 2, w: 24, h: 2 } }),
          createPanelJSONFixture({ id: 3, type: 'graph', gridPos: { x: 0, y: 4, w: 12, h: 2 } }),
          createPanelJSONFixture({ id: 4, type: 'graph', gridPos: { x: 12, y: 4, w: 12, h: 2 } }),
          createPanelJSONFixture({ id: 5, type: 'row', gridPos: { x: 0, y: 6, w: 24, h: 2 } }),
        ],
      });
      dashboard.toggleRow(dashboard.panels[1]);
    });

    it('should not impact hasUnsavedChanges', () => {
      expect(dashboard.hasUnsavedChanges()).toBe(false);
    });

    it('should impact hasUnsavedChanges if panels have changes when row is collapsed', () => {
      dashboard.panels[0].setProperty('title', 'new title');
      expect(dashboard.hasUnsavedChanges()).toBe(true);
    });

    it('should remove panels and put them inside collapsed row', () => {
      expect(dashboard.panels.length).toBe(3);
      expect(dashboard.panels[1].panels?.length).toBe(2);
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
      dashboard = createDashboardModelFixture({
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
          { id: 5, type: 'row', collapsed: false, panels: [], gridPos: { x: 0, y: 7, w: 1, h: 1 } },
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

  describe('When expanding row with panels that do not contain an x and y pos', () => {
    let dashboard: DashboardModel;

    beforeEach(() => {
      dashboard = createDashboardModelFixture({
        panels: [
          { id: 1, type: 'graph', gridPos: { x: 0, y: 0, w: 24, h: 6 } },
          {
            id: 2,
            type: 'row',
            gridPos: { x: 0, y: 6, w: 24, h: 1 },
            collapsed: true,
            panels: [
              // this whole test is about dealing with out-of-spec (or at least ambigious) data...
              //@ts-expect-error
              { id: 3, type: 'graph', gridPos: { w: 12, h: 2 } },
              //@ts-expect-error
              { id: 4, type: 'graph', gridPos: { w: 12, h: 2 } },
            ],
          },
          { id: 5, type: 'row', collapsed: false, panels: [], gridPos: { x: 0, y: 7, w: 1, h: 1 } },
        ],
      });
      dashboard.toggleRow(dashboard.panels[1]);
    });

    it('should correctly set the x and y values for the inner panels', () => {
      expect(dashboard.panels[2].gridPos).toMatchObject({
        x: 0,
        y: 7,
        w: 12,
        h: 2,
      });

      expect(dashboard.panels[3].gridPos).toMatchObject({
        x: 0,
        y: 7,
        w: 12,
        h: 2,
      });
    });
  });

  describe('Given model with time', () => {
    let model: DashboardModel;
    let consoleWarnSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      model = createDashboardModelFixture({
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

    afterEach(() => {
      consoleWarnSpy.mockRestore();
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

    it('getSaveModelClone should remove repeated panels and scopedVars', () => {
      const dashboardJSON = {
        panels: [
          { id: 1, type: 'row', repeat: 'dc', gridPos: { x: 0, y: 0, h: 1, w: 24 } },
          { id: 2, repeat: 'app', repeatDirection: 'h', gridPos: { x: 0, y: 1, h: 2, w: 8 } },
        ],
        templating: {
          list: [
            {
              name: 'dc',
              type: 'custom',
              current: {
                text: 'dc1 + dc2',
                value: ['dc1', 'dc2'],
              },
              options: [
                { text: 'dc1', value: 'dc1', selected: true },
                { text: 'dc2', value: 'dc2', selected: true },
              ],
            },
            {
              name: 'app',
              type: 'custom',
              current: {
                text: 'se1 + se2',
                value: ['se1', 'se2'],
              },
              options: [
                { text: 'se1', value: 'se1', selected: true },
                { text: 'se2', value: 'se2', selected: true },
              ],
            },
          ],
        },
      };

      const model = getDashboardModel(dashboardJSON);
      model.processRepeats();
      expect(model.panels.filter((x) => x.type === 'row')).toHaveLength(2);
      expect(model.panels.filter((x) => x.type !== 'row')).toHaveLength(4);
      expect(model.panels.find((x) => x.type !== 'row')?.scopedVars?.dc.value).toBe('dc1');
      expect(model.panels.find((x) => x.type !== 'row')?.scopedVars?.app.value).toBe('se1');

      const saveModel = model.getSaveModelClone();
      expect(saveModel.panels.length).toBe(2);
      expect(saveModel.panels[0].scopedVars).toBe(undefined);
      expect(saveModel.panels[1].scopedVars).toBe(undefined);

      model.collapseRows();
      const savedModelWithCollapsedRows = model.getSaveModelClone();
      expect(savedModelWithCollapsedRows.panels[0].panels!.length).toBe(1);
    });

    it('getSaveModelClone should not remove repeated panels and scopedVars during snapshot', () => {
      const dashboardJSON = {
        panels: [
          { id: 1, type: 'row', repeat: 'dc', gridPos: { x: 0, y: 0, h: 1, w: 24 } },
          { id: 2, repeat: 'app', repeatDirection: 'h', gridPos: { x: 0, y: 1, h: 2, w: 8 } },
        ],
        templating: {
          list: [
            {
              name: 'dc',
              type: 'custom',
              current: {
                text: 'dc1 + dc2',
                value: ['dc1', 'dc2'],
              },
              options: [
                { text: 'dc1', value: 'dc1', selected: true },
                { text: 'dc2', value: 'dc2', selected: true },
              ],
            },
            {
              name: 'app',
              type: 'custom',
              current: {
                text: 'se1 + se2',
                value: ['se1', 'se2'],
              },
              options: [
                { text: 'se1', value: 'se1', selected: true },
                { text: 'se2', value: 'se2', selected: true },
              ],
            },
          ],
        },
      };

      const model = getDashboardModel(dashboardJSON);
      model.processRepeats();
      expect(model.panels.filter((x) => x.type === 'row')).toHaveLength(2);
      expect(model.panels.filter((x) => x.type !== 'row')).toHaveLength(4);
      expect(model.panels.find((x) => x.type !== 'row')?.scopedVars?.dc.value).toBe('dc1');
      expect(model.panels.find((x) => x.type !== 'row')?.scopedVars?.app.value).toBe('se1');

      model.snapshot = { timestamp: new Date() };
      const saveModel = model.getSaveModelClone();
      expect(saveModel.panels.filter((x) => x.type === 'row')).toHaveLength(2);
      expect(saveModel.panels.filter((x) => x.type !== 'row')).toHaveLength(4);
      expect(saveModel.panels.find((x) => x.type !== 'row')?.scopedVars?.dc.value).toBe('dc1');
      expect(saveModel.panels.find((x) => x.type !== 'row')?.scopedVars?.app.value).toBe('se1');

      model.collapseRows();
      const savedModelWithCollapsedRows = model.getSaveModelClone();
      expect(savedModelWithCollapsedRows.panels[0].panels!.length).toBe(2);
    });
  });

  describe('Given model with template variable of type query', () => {
    let model: DashboardModel;

    beforeEach(() => {
      const json = {
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
      };
      model = getDashboardModel(json);
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
      const json = {
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
      };
      model = getDashboardModel(json);
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
      model = createDashboardModelFixture({
        panels: [
          { id: 1, type: 'graph', gridPos: { x: 0, y: 0, w: 24, h: 2 }, legend: { show: true } },
          { id: 3, type: 'graph', gridPos: { x: 0, y: 4, w: 12, h: 2 }, legend: { show: false } },
          { id: 4, type: 'graph', gridPos: { x: 12, y: 4, w: 12, h: 2 }, legend: { show: false } },
        ],
      });
    });

    it('toggleLegendsForAll should toggle all legends on on first execution', () => {
      model.toggleLegendsForAll();
      const legendsOn = model.panels.filter((panel) => panel.legend!.show === true);
      expect(legendsOn.length).toBe(3);
    });

    it('toggleLegendsForAll should toggle all legends off on second execution', () => {
      model.toggleLegendsForAll();
      model.toggleLegendsForAll();
      const legendsOn = model.panels.filter((panel) => panel.legend!.show === true);
      expect(legendsOn.length).toBe(0);
    });
  });

  describe('canAddAnnotations', () => {
    it.each`
      canEdit  | canMakeEditable | canAdd   | expected
      ${false} | ${true}         | ${true}  | ${true}
      ${true}  | ${false}        | ${true}  | ${true}
      ${true}  | ${true}         | ${true}  | ${true}
      ${false} | ${false}        | ${true}  | ${false}
      ${false} | ${true}         | ${false} | ${false}
      ${true}  | ${false}        | ${false} | ${false}
      ${true}  | ${true}         | ${false} | ${false}
      ${false} | ${false}        | ${false} | ${false}
    `(
      'when called with canEdit:{$canEdit}, canMakeEditable:{$canMakeEditable}, canAdd:{$canAdd} and expected:{$expected}',
      ({ canEdit, canMakeEditable, canAdd, expected }) => {
        const dashboard = createDashboardModelFixture(
          {},
          {
            annotationsPermissions: {
              dashboard: { canAdd, canEdit: true, canDelete: true },
              organization: { canAdd: false, canEdit: false, canDelete: false },
            },
          }
        );

        dashboard.meta.canEdit = canEdit;
        dashboard.meta.canMakeEditable = canMakeEditable;
        mockContextSrv.accessControlEnabled.mockReturnValue(true);
        const result = dashboard.canAddAnnotations();
        expect(result).toBe(expected);
      }
    );
  });

  describe('canEditAnnotations', () => {
    it.each`
      canEdit  | canMakeEditable | canEditWithOrgPermission | expected
      ${false} | ${true}         | ${true}                  | ${true}
      ${true}  | ${false}        | ${true}                  | ${true}
      ${true}  | ${true}         | ${true}                  | ${true}
      ${false} | ${false}        | ${true}                  | ${false}
      ${false} | ${true}         | ${false}                 | ${false}
      ${true}  | ${false}        | ${false}                 | ${false}
      ${true}  | ${true}         | ${false}                 | ${false}
      ${false} | ${false}        | ${false}                 | ${false}
    `(
      'when called with canEdit:{$canEdit}, canMakeEditable:{$canMakeEditable}, canEditWithOrgPermission:{$canEditWithOrgPermission} and expected:{$expected}',
      ({ canEdit, canMakeEditable, canEditWithOrgPermission, expected }) => {
        const dashboard = createDashboardModelFixture(
          {},
          {
            annotationsPermissions: {
              dashboard: { canAdd: false, canEdit: false, canDelete: true },
              organization: { canAdd: false, canEdit: canEditWithOrgPermission, canDelete: false },
            },
          }
        );

        dashboard.meta.canEdit = canEdit;
        dashboard.meta.canMakeEditable = canMakeEditable;
        mockContextSrv.accessControlEnabled.mockReturnValue(true);
        const result = dashboard.canEditAnnotations();
        expect(result).toBe(expected);
      }
    );

    it.each`
      canEdit  | canMakeEditable | canEditWithDashboardPermission | expected
      ${false} | ${true}         | ${true}                        | ${true}
      ${true}  | ${false}        | ${true}                        | ${true}
      ${true}  | ${true}         | ${true}                        | ${true}
      ${false} | ${false}        | ${true}                        | ${false}
      ${false} | ${true}         | ${false}                       | ${false}
      ${true}  | ${false}        | ${false}                       | ${false}
      ${true}  | ${true}         | ${false}                       | ${false}
      ${false} | ${false}        | ${false}                       | ${false}
    `(
      'when called with canEdit:{$canEdit}, canMakeEditable:{$canMakeEditable}, canEditWithDashboardPermission:{$canEditWithDashboardPermission} and expected:{$expected}',
      ({ canEdit, canMakeEditable, canEditWithDashboardPermission, expected }) => {
        const dashboard = createDashboardModelFixture(
          {},
          {
            annotationsPermissions: {
              dashboard: { canAdd: false, canEdit: canEditWithDashboardPermission, canDelete: true },
              organization: { canAdd: false, canEdit: false, canDelete: false },
            },
          }
        );

        dashboard.meta.canEdit = canEdit;
        dashboard.meta.canMakeEditable = canMakeEditable;
        mockContextSrv.accessControlEnabled.mockReturnValue(true);
        const result = dashboard.canEditAnnotations('testDashboardUID');
        expect(result).toBe(expected);
      }
    );
  });

  describe('canDeleteAnnotations', () => {
    it.each`
      canEdit  | canMakeEditable | canDeleteWithOrgPermission | expected
      ${false} | ${true}         | ${true}                    | ${true}
      ${true}  | ${false}        | ${true}                    | ${true}
      ${true}  | ${true}         | ${true}                    | ${true}
      ${false} | ${false}        | ${true}                    | ${false}
      ${false} | ${true}         | ${false}                   | ${false}
      ${true}  | ${false}        | ${false}                   | ${false}
      ${true}  | ${true}         | ${false}                   | ${false}
      ${false} | ${false}        | ${false}                   | ${false}
    `(
      'when called with canEdit:{$canEdit}, canMakeEditable:{$canMakeEditable}, canDeleteWithOrgPermission:{$canDeleteWithOrgPermission} and expected:{$expected}',
      ({ canEdit, canMakeEditable, canDeleteWithOrgPermission, expected }) => {
        const dashboard = createDashboardModelFixture(
          {},
          {
            annotationsPermissions: {
              dashboard: { canAdd: false, canEdit: false, canDelete: false },
              organization: { canAdd: false, canEdit: false, canDelete: canDeleteWithOrgPermission },
            },
          }
        );

        dashboard.meta.canEdit = canEdit;
        dashboard.meta.canMakeEditable = canMakeEditable;
        mockContextSrv.accessControlEnabled.mockReturnValue(true);
        const result = dashboard.canDeleteAnnotations();
        expect(result).toBe(expected);
      }
    );

    it.each`
      canEdit  | canMakeEditable | canDeleteWithDashboardPermission | expected
      ${false} | ${true}         | ${true}                          | ${true}
      ${true}  | ${false}        | ${true}                          | ${true}
      ${true}  | ${true}         | ${true}                          | ${true}
      ${false} | ${false}        | ${true}                          | ${false}
      ${false} | ${true}         | ${false}                         | ${false}
      ${true}  | ${false}        | ${false}                         | ${false}
      ${true}  | ${true}         | ${false}                         | ${false}
      ${false} | ${false}        | ${false}                         | ${false}
    `(
      'when called with canEdit:{$canEdit}, canMakeEditable:{$canMakeEditable}, canDeleteWithDashboardPermission:{$canDeleteWithDashboardPermission} and expected:{$expected}',
      ({ canEdit, canMakeEditable, canDeleteWithDashboardPermission, expected }) => {
        const dashboard = createDashboardModelFixture(
          {},
          {
            annotationsPermissions: {
              dashboard: { canAdd: false, canEdit: false, canDelete: canDeleteWithDashboardPermission },
              organization: { canAdd: false, canEdit: false, canDelete: false },
            },
          }
        );

        dashboard.meta.canEdit = canEdit;
        dashboard.meta.canMakeEditable = canMakeEditable;
        mockContextSrv.accessControlEnabled.mockReturnValue(true);
        const result = dashboard.canDeleteAnnotations('testDashboardUID');
        expect(result).toBe(expected);
      }
    );
  });

  describe('canEditPanel', () => {
    it('returns false if the dashboard cannot be edited', () => {
      const dashboard = createDashboardModelFixture({
        panels: [
          { id: 1, type: 'row', collapsed: false, panels: [], gridPos: { x: 0, y: 0, w: 24, h: 6 } },
          { id: 2, type: 'graph', gridPos: { x: 0, y: 7, w: 12, h: 2 } },
        ],
      });
      dashboard.meta.canEdit = false;
      const panel = dashboard.getPanelById(2);
      expect(dashboard.canEditPanel(panel)).toBe(false);
    });

    it('returns false if no panel is passed in', () => {
      const dashboard = createDashboardModelFixture({
        panels: [
          { id: 1, type: 'row', collapsed: false, panels: [], gridPos: { x: 0, y: 0, w: 24, h: 6 } },
          { id: 2, type: 'graph', gridPos: { x: 0, y: 7, w: 12, h: 2 } },
        ],
      });
      expect(dashboard.canEditPanel()).toBe(false);
    });

    it('returns false if the panel is a repeat', () => {
      const dashboard = createDashboardModelFixture({
        panels: [
          { id: 1, type: 'row', collapsed: false, panels: [], gridPos: { x: 0, y: 0, w: 24, h: 6 } },
          { id: 2, type: 'graph', gridPos: { x: 0, y: 7, w: 12, h: 2 } },
          { id: 3, type: 'graph', gridPos: { x: 0, y: 7, w: 12, h: 2 }, repeatPanelId: 2 },
        ],
      });
      const panel = dashboard.getPanelById(3);
      expect(dashboard.canEditPanel(panel)).toBe(false);
    });

    it('returns false if the panel is a row', () => {
      const dashboard = createDashboardModelFixture({
        panels: [
          { id: 1, type: 'row', collapsed: false, panels: [], gridPos: { x: 0, y: 0, w: 24, h: 6 } },
          { id: 2, type: 'graph', gridPos: { x: 0, y: 7, w: 12, h: 2 } },
        ],
      });
      const panel = dashboard.getPanelById(1);
      expect(dashboard.canEditPanel(panel)).toBe(false);
    });

    it('returns true otherwise', () => {
      const dashboard = createDashboardModelFixture({
        panels: [
          { id: 1, type: 'row', collapsed: false, panels: [], gridPos: { x: 0, y: 0, w: 24, h: 6 } },
          { id: 2, type: 'graph', gridPos: { x: 0, y: 7, w: 12, h: 2 } },
        ],
      });
      const panel = dashboard.getPanelById(2);
      expect(dashboard.canEditPanel(panel)).toBe(true);
    });
  });
});

describe('exitViewPanel', () => {
  function getTestContext() {
    const panel = new PanelModel({ setIsViewing: jest.fn() });
    const dashboard = createDashboardModelFixture();
    dashboard.startRefresh = jest.fn();
    dashboard.panelInView = panel;

    return { dashboard, panel };
  }

  describe('when called', () => {
    it('then panelInView is set to undefined', () => {
      const { dashboard, panel } = getTestContext();

      dashboard.exitViewPanel(panel);

      expect(dashboard.panelInView).toBeUndefined();
    });

    it('then setIsViewing is called on panel', () => {
      const { dashboard, panel } = getTestContext();

      dashboard.exitViewPanel(panel);

      expect(panel.setIsViewing).toHaveBeenCalledWith(false);
    });

    it('then startRefresh is not called', () => {
      const { dashboard, panel } = getTestContext();

      dashboard.exitViewPanel(panel);

      expect(dashboard.startRefresh).not.toHaveBeenCalled();
    });
  });
});

describe('exitPanelEditor', () => {
  function getTestContext(pauseAutoRefresh = false) {
    const panel = new PanelModel({ destroy: jest.fn() });
    const dashboard = createDashboardModelFixture();
    const timeSrvMock = {
      pauseAutoRefresh: jest.fn(),
      resumeAutoRefresh: jest.fn(),
      setAutoRefresh: jest.fn(),
    } as unknown as TimeSrv;
    dashboard.startRefresh = jest.fn();
    dashboard.panelInEdit = panel;
    if (pauseAutoRefresh) {
      timeSrvMock.autoRefreshPaused = true;
    }
    setTimeSrv(timeSrvMock);
    return { dashboard, panel, timeSrvMock };
  }

  describe('when called', () => {
    it('then panelInEdit is set to undefined', () => {
      const { dashboard } = getTestContext();

      dashboard.exitPanelEditor();

      expect(dashboard.panelInEdit).toBeUndefined();
    });

    it('then destroy is called on panel', () => {
      const { dashboard, panel } = getTestContext();

      dashboard.exitPanelEditor();

      expect(panel.destroy).toHaveBeenCalled();
    });

    it('then startRefresh is not called', () => {
      const { dashboard } = getTestContext();

      dashboard.exitPanelEditor();

      expect(dashboard.startRefresh).not.toHaveBeenCalled();
    });

    it('then auto refresh property is resumed', () => {
      const { dashboard, timeSrvMock } = getTestContext(true);
      dashboard.exitPanelEditor();
      expect(timeSrvMock.resumeAutoRefresh).toHaveBeenCalled();
    });
  });
});

describe('initEditPanel', () => {
  function getTestContext() {
    const dashboard = createDashboardModelFixture();
    const timeSrvMock = {
      pauseAutoRefresh: jest.fn(),
      resumeAutoRefresh: jest.fn(),
    } as unknown as TimeSrv;
    setTimeSrv(timeSrvMock);
    return { dashboard, timeSrvMock };
  }

  describe('when called', () => {
    it('then panelInEdit is not undefined', () => {
      const { dashboard } = getTestContext();
      dashboard.addPanel({ type: 'timeseries' });
      dashboard.initEditPanel(dashboard.panels[0]);
      expect(dashboard.panelInEdit).not.toBeUndefined();
    });

    it('then auto-refresh is paused', () => {
      const { dashboard, timeSrvMock } = getTestContext();
      dashboard.addPanel({ type: 'timeseries' });
      dashboard.initEditPanel(dashboard.panels[0]);
      expect(timeSrvMock.pauseAutoRefresh).toHaveBeenCalled();
    });
  });
});
