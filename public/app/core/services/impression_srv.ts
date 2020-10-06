import store from 'app/core/store';
import _ from 'lodash';
import config from 'app/core/config';

export class ImpressionSrv {
  constructor() {}

  addDashboardImpression(dashboardId: number) {
    const impressionsKey = this.impressionKey();
    let impressions = [];
    if (store.exists(impressionsKey)) {
      impressions = JSON.parse(store.get(impressionsKey));
      if (!_.isArray(impressions)) {
        impressions = [];
      }
    }

    impressions = impressions.filter(imp => {
      return dashboardId !== imp;
    });

    impressions.unshift(dashboardId);

    if (impressions.length > 50) {
      impressions.pop();
    }
    store.set(impressionsKey, JSON.stringify(impressions));
  }

  getDashboardOpened() {
    let impressions = store.get(this.impressionKey()) || '[]';

    impressions = JSON.parse(impressions);

    impressions = _.filter(impressions, el => {
      return _.isNumber(el);
    });

    return impressions;
  }

  impressionKey() {
    return 'dashboard_impressions-' + config.bootData.user.orgId;
  }
}

const impressionSrv = new ImpressionSrv();
export default impressionSrv;
