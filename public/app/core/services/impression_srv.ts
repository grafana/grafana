import { filter, isArray, isString } from 'lodash';

import config from 'app/core/config';
import store from 'app/core/store';

export class ImpressionSrv {
  constructor() {}

  addDashboardImpression(dashboardUID: string) {
    const impressionsKey = this.impressionKey();
    let impressions: string[] = [];
    if (store.exists(impressionsKey)) {
      impressions = JSON.parse(store.get(impressionsKey));
      if (!isArray(impressions)) {
        impressions = [];
      }
    }

    impressions = impressions.filter((imp) => {
      return dashboardUID !== imp;
    });

    impressions.unshift(dashboardUID);

    if (impressions.length > 50) {
      impressions.pop();
    }
    store.set(impressionsKey, JSON.stringify(impressions));
  }

  /** Returns an array of internal (string) dashboard UIDs */
  getDashboardOpened(): string[] {
    let impressions = store.get(this.impressionKey()) || '[]';

    impressions = JSON.parse(impressions);

    impressions = filter(impressions, (el) => {
      return isString(el);
    });

    return impressions;
  }

  impressionKey() {
    return 'dashboard_impressions-' + config.bootData.user.orgId;
  }
}

const impressionSrv = new ImpressionSrv();
export default impressionSrv;
