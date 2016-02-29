///<reference path="../../headers/common.d.ts" />

import store from 'app/core/store';
import _ from 'lodash';

export class ImpressionsStore {
  constructor() {}

  addDashboardImpression(slug) {
    var impressions = [];
    if (store.exists("dashboard_impressions")) {
      impressions = JSON.parse(store.get("dashboard_impressions"));
      if (!_.isArray(impressions)) {
        impressions = [];
      }
    }

    var exists = impressions.indexOf(slug);
    if (exists >= 0) {
      impressions.splice(exists, 1);
    }

    impressions.unshift(slug);

    if (impressions.length > 20) {
      impressions.shift();
    }
    store.set("dashboard_impressions", JSON.stringify(impressions));
  }

  getDashboardOpened() {
    var k = store.get("dashboard_impressions");
    return JSON.parse(k);
  }
}

var impressions = new ImpressionsStore();

export {
  impressions
};
