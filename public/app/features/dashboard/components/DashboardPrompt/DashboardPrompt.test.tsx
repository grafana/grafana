import { getPanelPlugin } from 'app/features/plugins/__mocks__/pluginMocks';

import { setContextSrv } from '../../../../core/services/context_srv';
import { DashboardModel } from '../../state/DashboardModel';
import { PanelModel } from '../../state/PanelModel';

import { hasChanges, ignoreChanges } from './DashboardPrompt';

function getDefaultDashboardModel(): DashboardModel {
  return new DashboardModel({
    refresh: false,
    panels: [
      {
        id: 1,
        type: 'graph',
        gridPos: { x: 0, y: 0, w: 24, h: 6 },
        legend: { sortDesc: false },
      },
      {
        id: 2,
        type: 'row',
        gridPos: { x: 0, y: 6, w: 24, h: 2 },
        collapsed: true,
        panels: [
          { id: 3, type: 'graph', gridPos: { x: 0, y: 6, w: 12, h: 2 } },
          { id: 4, type: 'graph', gridPos: { x: 12, y: 6, w: 12, h: 2 } },
        ],
      },
      { id: 5, type: 'row', gridPos: { x: 0, y: 6, w: 1, h: 1 } },
    ],
  });
}

function getTestContext() {
  const contextSrv: any = { isSignedIn: true, isEditor: true };
  setContextSrv(contextSrv);
  const dash: any = getDefaultDashboardModel();
  const original: any = dash.getSaveModelClone();

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
    dash.refresh = true;
    dash.schemaVersion = 10;
    expect(hasChanges(dash, original)).toBe(false);
  });

  it('Should ignore row collapse change', () => {
    const { original, dash } = getTestContext();
    dash.toggleRow(dash.panels[1]);
    expect(hasChanges(dash, original)).toBe(false);
  });

  it('Should ignore panel legend changes', () => {
    const { original, dash } = getTestContext();
    dash.panels[0].legend.sortDesc = true;
    dash.panels[0].legend.sort = 'avg';
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
        expect(ignoreChanges(null as unknown as DashboardModel, original)).toBe(true);
      });
    });

    describe('when called without meta in current dashboard', () => {
      it('then it should return true', () => {
        const { original, dash } = getTestContext();
        expect(ignoreChanges({ ...dash, meta: undefined }, original)).toBe(true);
      });
    });

    describe('when called for a viewer without save permissions', () => {
      it('then it should return true', () => {
        const { original, dash, contextSrv } = getTestContext();
        contextSrv.isEditor = false;
        expect(ignoreChanges({ ...dash, meta: { canSave: false } }, original)).toBe(true);
      });
    });

    describe('when called for a viewer with save permissions', () => {
      it('then it should return undefined', () => {
        const { original, dash, contextSrv } = getTestContext();
        contextSrv.isEditor = false;
        expect(ignoreChanges({ ...dash, meta: { canSave: true } }, original)).toBe(undefined);
      });
    });

    describe('when called for an user that is not signed in', () => {
      it('then it should return true', () => {
        const { original, dash, contextSrv } = getTestContext();
        contextSrv.isSignedIn = false;
        expect(ignoreChanges({ ...dash, meta: { canSave: true } }, original)).toBe(true);
      });
    });

    describe('when called with fromScript', () => {
      it('then it should return true', () => {
        const { original, dash } = getTestContext();
        expect(
          ignoreChanges({ ...dash, meta: { canSave: true, fromScript: true, fromFile: undefined } }, original)
        ).toBe(true);
      });
    });

    it('Should ignore panel schema migrations', () => {
      const { original, dash } = getTestContext();
      const plugin = getPanelPlugin({}).setMigrationHandler((panel) => {
        delete (panel as any).legend;
        return { option1: 'Aasd' };
      });

      dash.panels[0].pluginLoaded(plugin);
      expect(hasChanges(dash, original)).toBe(false);
    });

    describe('when called with fromFile', () => {
      it('then it should return true', () => {
        const { original, dash } = getTestContext();
        expect(
          ignoreChanges({ ...dash, meta: { canSave: true, fromScript: undefined, fromFile: true } }, original)
        ).toBe(true);
      });
    });

    describe('when called with canSave but without fromScript and fromFile', () => {
      it('then it should return false', () => {
        const { original, dash } = getTestContext();
        expect(
          ignoreChanges({ ...dash, meta: { canSave: true, fromScript: undefined, fromFile: undefined } }, original)
        ).toBe(undefined);
      });
    });
  });
});
