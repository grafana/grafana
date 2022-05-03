import memoizeOne from 'memoize-one';

import { getBackendSrv } from '@grafana/runtime';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification, createSuccessNotification } from 'app/core/copy/appNotification';
import { dispatch } from 'app/store/store';

export interface SharingConfiguration {
  dashboardUid: string;
  isPublic: boolean;
}

interface ApiSharingResp {
  success: boolean;
  isPublic: boolean;
}

export const savePublicConfig = memoizeOne(async function (conf: SharingConfiguration) {
  try {
    const payload = { isPublic: conf.isPublic };
    const url = `/api/dashboards/uid/${conf.dashboardUid}/public_dashboard_config`;
    const resp: ApiSharingResp = await getBackendSrv().post(url, payload);
    dispatch(notifyApp(createSuccessNotification('Dashboard sharing configuration saved')));
    return resp.isPublic;
  } catch (err) {
    console.error('Error while making dashboard public', err);
    dispatch(notifyApp(createErrorNotification('Error making dashboard public')));
    return conf.isPublic;
  }
});
