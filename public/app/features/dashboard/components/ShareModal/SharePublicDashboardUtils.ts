import memoizeOne from 'memoize-one';

import { getBackendSrv } from '@grafana/runtime';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification, createSuccessNotification } from 'app/core/copy/appNotification';
import { DashboardModel } from 'app/features/dashboard/state';
import { dispatch } from 'app/store/store';

export interface SharingConfiguration {
  dashboardUid: string;
  isPublic: boolean;
}

interface ApiSharingResp {
  success: boolean;
  isPublic: boolean;
}

export const dashboardCanBePublic = (dashboard: DashboardModel) => {
  console.log(dashboard.templating.list.length);
  return dashboard.templating.list.length === 0;
};

export const savePublicConfig = memoizeOne(async function (conf: SharingConfiguration) {
  try {
    const payload = { isPublic: conf.isPublic };
    const url = `/api/dashboards/uid/${conf.dashboardUid}/public-config`;
    const resp: ApiSharingResp = await getBackendSrv().post(url, payload);
    dispatch(notifyApp(createSuccessNotification('Dashboard sharing configuration saved')));
    return resp.isPublic;
  } catch (err) {
    console.error('Error while making dashboard public', err);
    dispatch(notifyApp(createErrorNotification('Error making dashboard public')));
    return conf.isPublic;
  }
});
