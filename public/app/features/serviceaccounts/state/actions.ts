import { ThunkResult } from '../../../types';
import { getBackendSrv } from '@grafana/runtime';
import { OrgServiceAccount as OrgServiceAccount } from 'app/types';
import { serviceAccountsLoaded } from './reducers';

const BASE_URL = `'/api/org/serviceaccounts'`;

export function loadServiceAccounts(): ThunkResult<void> {
  return async (dispatch) => {
    const serviceAccounts = await getBackendSrv().get(BASE_URL);
    dispatch(serviceAccountsLoaded(serviceAccounts));
  };
}

export function updateServiceAccount(serviceAccount: OrgServiceAccount): ThunkResult<void> {
  return async (dispatch) => {
    // TODO: implement on backend
    await getBackendSrv().patch(`${BASE_URL}/${serviceAccount.serviceAccountId}`, {
      role: serviceAccount.role,
    });
    dispatch(loadServiceAccounts());
  };
}

export function removeServiceAccount(serviceAccountId: number): ThunkResult<void> {
  return async (dispatch) => {
    await getBackendSrv().delete(`${BASE_URL}/${serviceAccountId}`);
    dispatch(loadServiceAccounts());
  };
}
