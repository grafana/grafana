import { ApiKey, ServiceAccountDTO, ThunkResult } from '../../../types';
import { getBackendSrv } from '@grafana/runtime';
import {
  acOptionsLoaded,
  builtInRolesLoaded,
  serviceAccountLoaded,
  serviceAccountsLoaded,
  serviceAccountTokensLoaded,
  serviceAccountToRemoveLoaded,
} from './reducers';
import { accessControlQueryParam } from 'app/core/utils/accessControl';
import { fetchBuiltinRoles, fetchRoleOptions } from 'app/core/components/RolePicker/api';

const BASE_URL = `/api/serviceaccounts`;

export function fetchACOptions(): ThunkResult<void> {
  return async (dispatch) => {
    try {
      const options = await fetchRoleOptions();
      dispatch(acOptionsLoaded(options));
      const builtInRoles = await fetchBuiltinRoles();
      dispatch(builtInRolesLoaded(builtInRoles));
    } catch (error) {
      console.error(error);
    }
  };
}

export function setServiceAccountToRemove(serviceAccount: ServiceAccountDTO | null): ThunkResult<void> {
  return async (dispatch) => {
    try {
      dispatch(serviceAccountToRemoveLoaded(serviceAccount));
    } catch (error) {
      console.error(error);
    }
  };
}

export function loadServiceAccount(saID: number): ThunkResult<void> {
  return async (dispatch) => {
    try {
      const response = await getBackendSrv().get(`${BASE_URL}/${saID}`, accessControlQueryParam());
      dispatch(serviceAccountLoaded(response));
    } catch (error) {
      console.error(error);
    }
  };
}

export function createServiceAccountToken(
  saID: number,
  token: ApiKey,
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

export function loadServiceAccounts(): ThunkResult<void> {
  return async (dispatch) => {
    try {
      const response = await getBackendSrv().get(BASE_URL, accessControlQueryParam());
      dispatch(serviceAccountsLoaded(response));
    } catch (error) {
      console.error(error);
    }
  };
}

export function updateServiceAccount(serviceAccount: ServiceAccountDTO): ThunkResult<void> {
  return async (dispatch) => {
    await getBackendSrv().patch(`/api/org/users/${serviceAccount.id}`, { role: serviceAccount.role });
    dispatch(loadServiceAccounts());
  };
}

export function removeServiceAccount(serviceAccountId: number): ThunkResult<void> {
  return async (dispatch) => {
    await getBackendSrv().delete(`${BASE_URL}/${serviceAccountId}`);
    dispatch(loadServiceAccounts());
  };
}
