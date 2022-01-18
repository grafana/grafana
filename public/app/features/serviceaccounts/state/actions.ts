import { ThunkResult } from '../../../types';
import { getBackendSrv } from '@grafana/runtime';
import { ServiceAccountDTO } from 'app/types';
import { serviceAccountLoaded, serviceAccountsLoaded } from './reducers';

const BASE_URL = `/api/org/serviceaccounts`;

export function loadServiceAccount(id: number): ThunkResult<void> {
  return async (dispatch) => {
    try {
      const serviceAccount = await getBackendSrv().get(`BASE_URL/${id}`);
      dispatch(serviceAccountLoaded(serviceAccount));
    } catch (error) {
      console.error(error);
    }
  };
}

export function loadServiceAccounts(): ThunkResult<void> {
  return async (dispatch) => {
    try {
      const serviceAccounts = await getBackendSrv().get(BASE_URL);
      dispatch(serviceAccountsLoaded(serviceAccounts));
    } catch (error) {
      console.error(error);
    }
  };
}

export function updateServiceAccount(serviceAccount: ServiceAccountDTO): ThunkResult<void> {
  return async (dispatch) => {
    // TODO: implement on backend
    await getBackendSrv().patch(`${BASE_URL}/${serviceAccount.userId}`, {});
    dispatch(loadServiceAccounts());
  };
}

export function removeServiceAccount(serviceAccountId: number): ThunkResult<void> {
  return async (dispatch) => {
    await getBackendSrv().delete(`${BASE_URL}/${serviceAccountId}`);
    dispatch(loadServiceAccounts());
  };
}
