import { throttle } from 'lodash';

import { getBackendSrv } from '@grafana/runtime';
import { SupportBundle, ThunkResult } from 'app/types';

import { fetchBegin, fetchEnd, supportBundlesLoaded } from './reducers';

export function loadBundles(): ThunkResult<void> {
  return async (dispatch) => {
    try {
      dispatch(fetchBegin());
      const result = await getBackendSrv().get<SupportBundle[]>('/api/support-bundles');
      dispatch(supportBundlesLoaded(result));
    } finally {
      dispatch(fetchEnd());
    }
  };
}

const checkBundlesStatusThrottled = throttle(async (dispatch) => {
  const result = await getBackendSrv().get<SupportBundle[]>('/api/support-bundles');
  dispatch(supportBundlesLoaded(result));
}, 1000);

export function checkBundles(): ThunkResult<void> {
  return async (dispatch) => {
    dispatch(checkBundlesStatusThrottled);
  };
}

export function removeBundle(uid: string): ThunkResult<void> {
  return async (dispatch) => {
    await getBackendSrv().delete(`/api/support-bundles/${uid}`);
    dispatch(loadBundles());
  };
}
