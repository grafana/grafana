import { getBackendSrv, locationService } from '@grafana/runtime';
import { accessControlQueryParam } from 'app/core/utils/accessControl';
import { ServiceAccountDTO, ThunkResult } from 'app/types';

import { ServiceAccountToken } from '../components/CreateTokenModal';

import {
  serviceAccountFetchBegin,
  serviceAccountFetchEnd,
  serviceAccountLoaded,
  serviceAccountTokensLoaded,
} from './reducers';

const BASE_URL = `/api/serviceaccounts`;

export function loadServiceAccount(saID: number): ThunkResult<void> {
  return async (dispatch) => {
    dispatch(serviceAccountFetchBegin());
    try {
      const response = await getBackendSrv().get(`${BASE_URL}/${saID}`, accessControlQueryParam());
      dispatch(serviceAccountLoaded(response));
    } catch (error) {
      console.error(error);
    } finally {
      dispatch(serviceAccountFetchEnd());
    }
  };
}

export function updateServiceAccount(serviceAccount: ServiceAccountDTO): ThunkResult<void> {
  return async (dispatch) => {
    await getBackendSrv().patch(`${BASE_URL}/${serviceAccount.id}?accesscontrol=true`, {
      ...serviceAccount,
    });
    dispatch(loadServiceAccount(serviceAccount.id));
  };
}

export function deleteServiceAccount(serviceAccountId: number): ThunkResult<void> {
  return async () => {
    await getBackendSrv().delete(`${BASE_URL}/${serviceAccountId}`);
    locationService.push('/org/serviceaccounts');
  };
}

export function createServiceAccountToken(
  saID: number,
  token: ServiceAccountToken,
  onTokenCreated: (key: string) => void
): ThunkResult<void> {
  return async (dispatch) => {
    const result = await getBackendSrv().post(`${BASE_URL}/${saID}/tokens`, token);
    onTokenCreated(result.key);
    dispatch(loadServiceAccountTokens(saID));
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
