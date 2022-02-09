import { ThunkResult } from '../../../types';
import { getBackendSrv } from '@grafana/runtime';
import { serviceAccountLoaded, serviceAccountsLoaded, serviceAccountTokensLoaded } from './reducers';

const BASE_URL = `/api/serviceaccounts`;

export function loadServiceAccount(saID: number): ThunkResult<void> {
  return async (dispatch) => {
    try {
      const response = await getBackendSrv().get(`${BASE_URL}/${saID}`);
      dispatch(serviceAccountLoaded(response));
    } catch (error) {
      console.error(error);
    }
  };
}

export function deleteServiceAccountToken(saID: number, id: number): ThunkResult<void> {
  return async (dispatch) => {
    await getBackendSrv().delete(`${BASE_URL}/${saID}/tokens/${id}`);
    dispatch(loadServiceAccountTokens(saID));
  };
}

export function loadServiceAccountTokens(saID: number): ThunkResult<void> {
  return async (dispatch) => {
    try {
      const response = await getBackendSrv().get(`${BASE_URL}/${saID}/tokens`);
      dispatch(serviceAccountTokensLoaded(response));
    } catch (error) {
      console.error(error);
    }
  };
}

export function loadServiceAccounts(): ThunkResult<void> {
  return async (dispatch) => {
    try {
      const response = await getBackendSrv().get(BASE_URL);
      dispatch(serviceAccountsLoaded(response));
    } catch (error) {
      console.error(error);
    }
  };
}

export function updateServiceAccount(saID: number): ThunkResult<void> {
  return async (dispatch) => {
    // TODO: implement on backend
    await getBackendSrv().patch(`${BASE_URL}/${saID}`, {});
    dispatch(loadServiceAccounts());
  };
}

export function removeServiceAccount(serviceAccountId: number): ThunkResult<void> {
  return async (dispatch) => {
    await getBackendSrv().delete(`${BASE_URL}/${serviceAccountId}`);
    dispatch(loadServiceAccounts());
  };
}
