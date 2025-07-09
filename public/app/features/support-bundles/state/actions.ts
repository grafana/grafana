import { throttle } from 'lodash';

import { getBackendSrv, locationService } from '@grafana/runtime';
import { ThunkResult } from 'app/types/store';
import { SupportBundle, SupportBundleCollector, SupportBundleCreateRequest } from 'app/types/supportBundles';

import {
  collectorsFetchBegin,
  collectorsFetchEnd,
  fetchBegin,
  fetchEnd,
  setCreateBundleError,
  setLoadBundleError,
  supportBundleCollectorsLoaded,
  supportBundlesLoaded,
} from './reducers';

export function loadBundles(skipPageRefresh = false): ThunkResult<void> {
  return async (dispatch) => {
    try {
      if (!skipPageRefresh) {
        dispatch(fetchBegin());
      }
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
    dispatch(loadBundles(true));
  };
}

export function loadSupportBundleCollectors(): ThunkResult<void> {
  return async (dispatch) => {
    try {
      dispatch(collectorsFetchBegin());
      const result = await getBackendSrv().get<SupportBundleCollector[]>('/api/support-bundles/collectors');
      dispatch(supportBundleCollectorsLoaded(result));
    } catch (err) {
      dispatch(setLoadBundleError('Error loading support bundles data collectors'));
    } finally {
      dispatch(collectorsFetchEnd());
    }
  };
}

export function createSupportBundle(data: SupportBundleCreateRequest): ThunkResult<void> {
  return async (dispatch) => {
    try {
      await getBackendSrv().post('/api/support-bundles', data);
      locationService.push('/support-bundles');
    } catch (err) {
      dispatch(setCreateBundleError('Error creating support bundle'));
    }
  };
}
