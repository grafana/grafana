///<reference path="../../headers/common.d.ts" />

import store from 'app/core/store';
import _ from 'lodash';

export class ImpressionsStore {
  constructor() {}

  addDashboardImpression(impression) {
    console.log(impression);
    var impressions = [];
    if (store.exists("dashboard_impressions")) {
      impressions = JSON.parse(store.get("dashboard_impressions"));
      if (!_.isArray(impressions)) {
        impressions = [];
      }
    }

    impressions = impressions.filter((imp) => {
      return impression.meta.slug !== imp.slug;
    });

    impressions.unshift({
      title: impression.dashboard.title,
      slug: impression.meta.slug
    });

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
