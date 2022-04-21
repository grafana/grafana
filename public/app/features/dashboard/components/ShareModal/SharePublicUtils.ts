import memoizeOne from 'memoize-one';
import { getBackendSrv } from '@grafana/runtime';
import { dispatch } from 'app/store/store';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification, createSuccessNotification } from 'app/core/copy/appNotification';

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
    const resp: ApiSharingResp = await getBackendSrv().post(`/api/dashboards/uid/${conf.dashboardUid}/sharing`, {
      isPublic: conf.isPublic,
    });
    dispatch(notifyApp(createSuccessNotification('Dashboard sharing configuration saved')));
    return resp.isPublic;
  } catch (err) {
    console.error('Error while making dashboard public', err);
    dispatch(notifyApp(createErrorNotification('Error making dashboard public')));
    return conf.isPublic;
  }
});
