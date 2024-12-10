import { filter, isArray, isNumber, isString } from 'lodash';

import { getBackendSrv } from '@grafana/runtime';
import { DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0/dashboard.gen';
import config from 'app/core/config';
import store from 'app/core/store';
import { DashboardWithAccessInfo } from 'app/features/dashboard/api/types';
import { isDashboardResource } from 'app/features/dashboard/api/utils';
import { DashboardDTO } from 'app/types';

export class ImpressionSrv {
  constructor() {}

  addDashboardImpression(dashboard: DashboardDTO | DashboardWithAccessInfo<DashboardV2Spec>) {
    const shouldAddImpression = isDashboardResource(dashboard) || dashboard.meta.dashboardNotFound !== true;

    if (!shouldAddImpression) {
      return;
    }

    const dashboardUID = isDashboardResource(dashboard) ? dashboard.metadata.name : dashboard.dashboard.uid;

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

  private async convertToUIDs() {
    let impressions = this.getImpressions();
    const ids = filter(impressions, (el) => isNumber(el));
    if (!ids.length) {
      return;
    }

    const convertedUIDs = await getBackendSrv().get<string[]>(`/api/dashboards/ids/${ids.join(',')}`);
    store.set(this.impressionKey(), JSON.stringify([...filter(impressions, (el) => isString(el)), ...convertedUIDs]));
  }

  private getImpressions() {
    const impressions = store.get(this.impressionKey()) || '[]';

    return JSON.parse(impressions);
  }

  /** Returns an array of internal (string) dashboard UIDs */
  async getDashboardOpened(): Promise<string[]> {
    // TODO should be removed after UID migration
    try {
      await this.convertToUIDs();
    } catch (_) {}

    const result = filter(this.getImpressions(), (el) => isString(el));
    return result;
  }

  impressionKey() {
    return 'dashboard_impressions-' + config.bootData.user.orgId;
  }
}

const impressionSrv = new ImpressionSrv();
export default impressionSrv;
