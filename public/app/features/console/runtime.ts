import { UrlQueryMap } from '@grafana/data';
import { getLocationSrv } from '@grafana/runtime';
import { getConfig } from 'app/core/config';
import { getDashboardSrv } from '../dashboard/services/DashboardSrv';
import { getTimeSrv } from '../dashboard/services/TimeSrv';

export function initRuntime() {
  (window as any).grafanaRuntime = {
    /** flag for theme type */
    getThemeType: () => {
      const theme = getConfig().theme2;
      if (theme.isDark) {
        return 'dark';
      }
      if (theme.isLight) {
        return 'light';
      }
      return '?';
    },

    /** Navigate the page within the currently loaded application */
    load: (path: string, query?: UrlQueryMap) => {
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
    getDashboardInfo: () => {
      const d = getDashboardSrv().getCurrent();
      if (!d) {
        return undefined;
      }
      const tr = getTimeSrv().timeRange();
      return {
        model: d.getSaveModelClone(),
        timeRange: {
          from: tr.from.valueOf(),
          to: tr.to.valueOf(),
          raw: tr.raw,
        },
      };
    },
  };
}
