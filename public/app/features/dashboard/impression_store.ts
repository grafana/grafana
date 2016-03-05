///<reference path="../../headers/common.d.ts" />

import store from 'app/core/store';
import _ from 'lodash';

export class ImpressionsStore {
  constructor() {}

  addDashboardImpression(dashboardId) {
    var impressions = [];
    if (store.exists("dashboard_impressions")) {
      impressions = JSON.parse(store.get("dashboard_impressions"));
      if (!_.isArray(impressions)) {
        impressions = [];
      }
    }

    impressions = impressions.filter((imp) => {
      return dashboardId !== imp;
    });

    impressions.unshift(dashboardId);

    if (impressions.length > 50) {
      impressions.pop();
    }
    store.set("dashboard_impressions", JSON.stringify(impressions));
  }

  getDashboardOpened() {
    var impressions = store.get("dashboard_impressions");
    return JSON.parse(impressions || "[]");
  }
}

var impressions = new ImpressionsStore();

export {
  impressions
};
