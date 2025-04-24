import { getPanelPlugin } from '@grafana/data/test';

import { ContextSrv, setContextSrv } from '../../../../core/services/context_srv';
import { PanelModel } from '../../state/PanelModel';
import { createDashboardModelFixture, createPanelSaveModel } from '../../state/__fixtures__/dashboardFixtures';

import { hasChanges, ignoreChanges } from './DashboardPrompt';

function getDefaultDashboardModel() {
  return createDashboardModelFixture({
    panels: [
      createPanelSaveModel({
        id: 1,
        type: 'timeseries',
        gridPos: { x: 0, y: 0, w: 24, h: 6 },
        options: {
          legend: { showLegend: true },
        },
      }),

      {
        id: 2,
        type: 'row',
        gridPos: { x: 0, y: 6, w: 24, h: 2 },
        collapsed: true,
        panels: [
          { id: 3, type: 'timeseries', gridPos: { x: 0, y: 6, w: 12, h: 2 }, options: {} },
          { id: 4, type: 'timeseries', gridPos: { x: 12, y: 6, w: 12, h: 2 }, options: {} },
        ],
      },
      { id: 5, type: 'row', gridPos: { x: 0, y: 6, w: 1, h: 1 }, collapsed: false, panels: [] },
    ],
  });
}

function getTestContext() {
  const contextSrv = { isSignedIn: true, isEditor: true } as ContextSrv;
  setContextSrv(contextSrv);
  const dash = getDefaultDashboardModel();
  const original = dash.getSaveModelCloneOld();

  return { dash, original, contextSrv };
}

describe('DashboardPrompt', () => {
  it('No changes should not have changes', () => {
    const { original, dash } = getTestContext();
    expect(hasChanges(dash, original)).toBe(false);
  });

  it('Simple change should be registered', () => {
    const { original, dash } = getTestContext();
    dash.title = 'google';
    expect(hasChanges(dash, original)).toBe(true);
  });

  it('Should ignore a lot of changes', () => {
    const { original, dash } = getTestContext();
    dash.time = { from: '1h' };
    dash.refresh = '30s';
    dash.schemaVersion = 10;
    expect(hasChanges(dash, original)).toBe(false);
  });

  it('Should ignore row collapse change', () => {
    const { original, dash } = getTestContext();
    dash.toggleRow(dash.panels[1]);
    expect(hasChanges(dash, original)).toBe(false);
  });

  it('Should ignore panel changes as those are handled via dirty flag', () => {
    const { original, dash } = getTestContext();
    dash.panels[0]!.options = { legend: { showLegend: false } };
    expect(hasChanges(dash, original)).toBe(false);
  });

  it('Should ignore panel repeats', () => {
    const { original, dash } = getTestContext();
    dash.panels.push(new PanelModel({ repeatPanelId: 10 }));
    expect(hasChanges(dash, original)).toBe(false);
  });

  describe('ignoreChanges', () => {
    describe('when called without original dashboard', () => {
      it('then it should return true', () => {
        const { dash } = getTestContext();
        expect(ignoreChanges(dash, null)).toBe(true);
      });
    });

    describe('when called without current dashboard', () => {
      it('then it should return true', () => {
        const { original } = getTestContext();
        expect(ignoreChanges(null, original)).toBe(true);
      });
    });

    describe('when called for a viewer without save permissions', () => {
      it('then it should return true', () => {
        const { contextSrv } = getTestContext();
        const dash = createDashboardModelFixture({}, { canSave: false });
        const original = dash.getSaveModelCloneOld();
        contextSrv.isEditor = false;
        expect(ignoreChanges(dash, original)).toBe(true);
      });
    });

    describe('when called for a viewer with save permissions', () => {
      it('then it should return undefined', () => {
        const { contextSrv } = getTestContext();
        const dash = createDashboardModelFixture({}, { canSave: true });
        const original = dash.getSaveModelCloneOld();
        contextSrv.isEditor = false;
        expect(ignoreChanges(dash, original)).toBe(undefined);
      });
    });

    describe('when called for an user that is not signed in', () => {
      it('then it should return true', () => {
        const { contextSrv } = getTestContext();
        const dash = createDashboardModelFixture({}, { canSave: true });
        const original = dash.getSaveModelCloneOld();
        contextSrv.isSignedIn = false;
        expect(ignoreChanges(dash, original)).toBe(true);
      });
    });

    describe('when called with fromScript', () => {
      it('then it should return true', () => {
        const dash = createDashboardModelFixture({}, { canSave: true, fromScript: true, fromFile: undefined });
        const original = dash.getSaveModelCloneOld();
        expect(ignoreChanges(dash, original)).toBe(true);
      });
    });

    it('Should ignore panel schema migrations', async () => {
      const { original, dash } = getTestContext();
      const plugin = getPanelPlugin({}).setMigrationHandler((panel) => {
        delete (panel as any).legend;
        return { option1: 'Aasd' };
      });

      await dash.panels[0].pluginLoaded(plugin);
      expect(hasChanges(dash, original)).toBe(false);
    });

    describe('when called with fromFile', () => {
      it('then it should return true', () => {
        const dash = createDashboardModelFixture({}, { canSave: true, fromScript: undefined, fromFile: true });
        const original = dash.getSaveModelCloneOld();
        expect(ignoreChanges(dash, original)).toBe(true);
      });
    });

    describe('when called with canSave but without fromScript and fromFile', () => {
      it('then it should return false', () => {
        const dash = createDashboardModelFixture({}, { canSave: true, fromScript: undefined, fromFile: undefined });
        const original = dash.getSaveModelCloneOld();
        expect(ignoreChanges(dash, original)).toBe(undefined);
      });
    });
  });
});
