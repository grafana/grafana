import { ThunkResult } from '../../../types';
import { getBackendSrv } from '@grafana/runtime';
import { OrgServiceaccount } from 'app/types';
import { serviceaccountsLoaded } from './reducers';

export function loadserviceaccounts(): ThunkResult<void> {
  return async (dispatch) => {
    const serviceaccounts = await getBackendSrv().get('/api/serviceaccounts');
    dispatch(serviceaccountsLoaded(serviceaccounts));
  };
}

export function updateserviceaccount(serviceaccount: OrgServiceaccount): ThunkResult<void> {
  return async (dispatch) => {
    // TODO: implement on backend
    await getBackendSrv().patch(`/api/serviceaccounts/${serviceaccount.serviceaccountId}`, {
      role: serviceaccount.role,
    });
    dispatch(loadserviceaccounts());
  };
}

export function removeserviceaccount(serviceaccountId: number): ThunkResult<void> {
  return async (dispatch) => {
    await getBackendSrv().delete(`/api/serviceaccounts/${serviceaccountId}`);
    dispatch(loadserviceaccounts());
  };
}
