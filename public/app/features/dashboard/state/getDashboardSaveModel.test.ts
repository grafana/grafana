import { StoreState } from 'app/types';
import { getDashboardModel } from 'test/helpers/getDashboardModel';
import { DashboardModel } from '../state/DashboardModel';
import { getDashboardSaveModel } from './getDashboardSaveModel';
import { initialState } from './reducers';

describe('getSaveModelClone', () => {
  it('should sort keys', () => {
    const state = getStoreStateFor(new DashboardModel({}));
    const saveModel = getDashboardSaveModel(state as StoreState);
    const keys = Object.keys(saveModel);

    expect(keys[0]).toBe('annotations');
    expect(keys[1]).toBe('editable');
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

    const storeState = getStoreStateFor(model);
    const saveModel = getDashboardSaveModel(storeState);
    const panels = saveModel.panels;

    expect(panels.length).toBe(1);
  });

  it('should save model in edit mode', () => {
    const model = new DashboardModel({});
    model.addPanel({ type: 'graph' });

    const panel = model.initEditPanel(model.panels[0]);
    panel.title = 'updated';

    const storeState = getStoreStateFor(model);
    const saveModel = getDashboardSaveModel(storeState);
    const savedPanel = saveModel.panels[0];

    expect(savedPanel.title).toBe('updated');
    expect(savedPanel.id).toBe(model.panels[0].id);
  });

  it('Should remove meta', () => {
    const state = getStoreStateFor(new DashboardModel({}));
    const saveModel = getDashboardSaveModel(state as StoreState);
    expect((saveModel as any).meta).toBe(undefined);
  });

  describe('Given dashboard with modified time', () => {
    let state: StoreState;
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
      state = getStoreStateFor(model);
    });

    it('hasTimeChanged should be true', () => {
      expect(state.dashboard.getModel()!.hasTimeChanged()).toBeTruthy();
    });

    it('Should return original time when saveTimerange=false', () => {
      const options = { saveTimerange: false };
      const saveModel = getDashboardSaveModel(state, options);

      expect(saveModel.time?.from).toBe('now-6h');
      expect(saveModel.time?.to).toBe('now');
    });

    it('getSaveModelClone should return updated time when saveTimerange=true', () => {
      const options = { saveTimerange: true };
      const saveModel = getDashboardSaveModel(state, options);

      expect(saveModel.time?.from).toBe('now-3h');
      expect(saveModel.time?.to).toBe('now-1h');
    });

    it('hasTimeChanged should be false when reset original time', () => {
      model.resetOriginalTime();
      expect(model.hasTimeChanged()).toBeFalsy();
    });

    it('getSaveModelClone should return original time when saveTimerange=false', () => {
      const options = { saveTimerange: false };
      const saveModel = getDashboardSaveModel(state, options);

      expect(saveModel.time?.from).toBe('now-6h');
      expect(saveModel.time?.to).toBe('now');
    });

    it('getSaveModelClone should return updated time when saveTimerange=true', () => {
      const options = { saveTimerange: true };
      const saveModel = getDashboardSaveModel(state, options);

      expect(saveModel.time?.from).toBe('now-3h');
      expect(saveModel.time?.to).toBe('now-1h');
    });
  });

  describe('Given dashboard with modified time', () => {
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

      const state = getStoreStateFor(model);
      const saveModel = getDashboardSaveModel(state);
      expect(saveModel.panels.length).toBe(2);
      expect((saveModel.panels[0] as any).scopedVars).toBe(undefined);
      expect((saveModel.panels[1] as any).scopedVars).toBe(undefined);

      model.collapseRows();
      const savedModelWithCollapsedRows: any = getDashboardSaveModel(state);
      expect(savedModelWithCollapsedRows.panels[0].panels.length).toBe(1);
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
      const state = getStoreStateFor(model);
      const saveModel = getDashboardSaveModel(state);

      expect(saveModel.panels.filter((x) => x.type === 'row')).toHaveLength(2);
      expect(saveModel.panels.filter((x) => x.type !== 'row')).toHaveLength(4);

      expect(saveModel.panels.find((x) => x.type !== 'row')?.scopedVars?.dc.value).toBe('dc1');
      expect(saveModel.panels.find((x) => x.type !== 'row')?.scopedVars?.app.value).toBe('se1');

      model.collapseRows();
      const savedModelWithCollapsedRows: any = getDashboardSaveModel(state);
      expect(savedModelWithCollapsedRows.panels[0].panels.length).toBe(2);
    });
  });
});

function getStoreStateFor(dashboard: DashboardModel): StoreState {
  return {
    dashboard: {
      ...initialState,
      getModel: () => dashboard,
    },
    templating: {
      // how to define variable redux state from stored state???
      variables: {},
      // variables: dashboard.templating.list,
    },
  } as StoreState;
}
