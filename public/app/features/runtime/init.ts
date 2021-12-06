import { UrlQueryMap, PanelData } from '@grafana/data';
import { getLocationSrv } from '@grafana/runtime';
import { getDashboardSrv } from '../dashboard/services/DashboardSrv';
import { getTimeSrv } from '../dashboard/services/TimeSrv';

/**
 * This will setup features that are accessible through the root window location
 *
 * This is useful for manipulating the application from external drivers like puppetter/cypress
 *
 * @internal and subject to change
 */
export function initWindowRuntime() {
  (window as any).grafanaRuntime = {
    /** Navigate the page within the currently loaded application */
    updateLocation: (path: string, query?: UrlQueryMap) => {
      if (query?.theme) {
        throw new Error(`chaning theme requires full page refresh`);
      }
      getLocationSrv().update({
        path,
        query,
        replace: true,
        partial: false,
      });
    },

    /** Get info for the current dashboard.  This will include the migrated dashboard JSON */
    getDashboardSaveModel: () => {
      const d = getDashboardSrv().getCurrent();
      if (!d) {
        return undefined;
      }
      return d.getSaveModelClone();
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
      return d.panels.reduce((acc, panel) => {
        acc[panel.id] = panel.getQueryRunner().getLastResult();
        return acc;
      }, {} as Record<number, PanelData | undefined>);
    },
  };
}
