import { PanelData, RawTimeRange } from '@grafana/data';
import { getDashboardApi } from '@grafana/runtime';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';

import { DashboardModel } from '../dashboard/state/DashboardModel';

declare global {
  interface Window {
    grafanaRuntime?: {
      getDashboardSaveModel: () => DashboardModel | undefined;
      getDashboardTimeRange: () => { from: number; to: number; raw: RawTimeRange };
      getPanelData: () => Record<number, PanelData | undefined> | undefined;
    };
    /**
     * Exposes the current-dashboard schema v2 JSON API for debugging / automation.
     * Intended for browser console usage.
     */
    dashboardApi?: {
      help: () => string;
      schema: {
        getSources: (space?: number) => string;
        getDashboard: (space?: number) => Promise<string>;
        getDashboardSync: (space?: number) => string;
      };
      navigation: {
        getCurrent: (space?: number) => string;
        selectTab: (tabJson: string) => void;
        focusRow: (rowJson: string) => void;
        focusPanel: (panelJson: string) => void;
      };
      variables: {
        getCurrent: (space?: number) => string;
        apply: (varsJson: string) => void;
      };
      timeRange: {
        getCurrent: (space?: number) => string;
        apply: (timeRangeJson: string) => void;
      };
      errors: {
        getCurrent: (space?: number) => string;
      };
      dashboard: {
        getCurrent: (space?: number) => string;
        apply: (resourceJson: string) => void;
      };
    };
  }
}

/**
 * This will setup features that are accessible through the root window location
 *
 * This is useful for manipulating the application from external drivers like puppetter/cypress
 *
 * @internal and subject to change
 */
export function initWindowRuntime() {
  window.grafanaRuntime = {
    /** Get info for the current dashboard.  This will include the migrated dashboard JSON */
    getDashboardSaveModel: () => {
      const d = getDashboardSrv().getCurrent();
      if (!d) {
        return undefined;
      }
      return d.getSaveModelCloneOld();
    },

    /** The selected time range */
    getDashboardTimeRange: () => {
      const tr = getTimeSrv().timeRange();
      return {
        from: tr.from.valueOf(),
        to: tr.to.valueOf(),
        raw: tr.raw,
      };
    },

    /** Get the query results for the last loaded data */
    getPanelData: () => {
      const d = getDashboardSrv().getCurrent();
      if (!d) {
        return undefined;
      }
      return d.panels.reduce<Record<number, PanelData | undefined>>((acc, panel) => {
        acc[panel.id] = panel.getQueryRunner().getLastResult();
        return acc;
      }, {});
    },
  };

  // Expose the same API that plugins use via @grafana/runtime, but on `window` for easy console access.
  // Only the grouped API surface is exposed.
  window.dashboardApi = getDashboardApi();
}
