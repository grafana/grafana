import { ThunkResult } from '../../../types';
import { getBackendSrv } from '@grafana/runtime';
import { OrgServiceAccount as OrgServiceAccount } from 'app/types';
import { serviceAccountsLoaded } from './reducers';

export function loadServiceAccounts(): ThunkResult<void> {
  return async (dispatch) => {
    const serviceAccounts = await getBackendSrv().get('/api/serviceaccounts');
    dispatch(serviceAccountsLoaded(serviceAccounts));
  };
}

export function updateServiceAccount(serviceAccount: OrgServiceAccount): ThunkResult<void> {
  return async (dispatch) => {
    // TODO: implement on backend
    await getBackendSrv().patch(`/api/serviceaccounts/${serviceAccount.serviceAccountId}`, {
      role: serviceAccount.role,
    });
    dispatch(loadServiceAccounts());
  };
}

export function removeServiceAccount(serviceAccountId: number): ThunkResult<void> {
  return async (dispatch) => {
    await getBackendSrv().delete(`/api/serviceaccounts/${serviceAccountId}`);
    dispatch(loadServiceAccounts());
  };
}
