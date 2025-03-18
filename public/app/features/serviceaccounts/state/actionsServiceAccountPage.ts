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

export function loadServiceAccount(saUid: string): ThunkResult<void> {
  return async (dispatch) => {
    dispatch(serviceAccountFetchBegin());
    try {
      const response = await getBackendSrv().get(`${BASE_URL}/${saUid}`, accessControlQueryParam());
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
    await getBackendSrv().patch(`${BASE_URL}/${serviceAccount.uid}?accesscontrol=true`, {
      ...serviceAccount,
    });
    dispatch(loadServiceAccount(serviceAccount.uid));
  };
}

export function deleteServiceAccount(serviceAccountUid: string): ThunkResult<void> {
  return async () => {
    await getBackendSrv().delete(`${BASE_URL}/${serviceAccountUid}`);
    locationService.push('/org/serviceaccounts');
  };
}

export function createServiceAccountToken(
  saUid: string,
  token: ServiceAccountToken,
  onTokenCreated: (key: string) => void
): ThunkResult<void> {
  return async (dispatch) => {
    const result = await getBackendSrv().post(`${BASE_URL}/${saUid}/tokens`, token);
    onTokenCreated(result.key);
    dispatch(loadServiceAccountTokens(saUid));
  };
}

export function deleteServiceAccountToken(saUid: string, id: number): ThunkResult<void> {
  return async (dispatch) => {
    await getBackendSrv().delete(`${BASE_URL}/${saUid}/tokens/${id}`);
    dispatch(loadServiceAccountTokens(saUid));
  };
}

export function loadServiceAccountTokens(saUid: string): ThunkResult<void> {
  return async (dispatch) => {
    try {
      const response = await getBackendSrv().get(`${BASE_URL}/${saUid}/tokens`);
      dispatch(serviceAccountTokensLoaded(response));
    } catch (error) {
      console.error(error);
    }
  };
}
