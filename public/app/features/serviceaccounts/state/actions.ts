import { debounce } from 'lodash';

import { getBackendSrv } from '@grafana/runtime';
import { fetchRoleOptions } from 'app/core/components/RolePicker/api';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction, ServiceAccountDTO, ServiceAccountStateFilter, ThunkResult } from 'app/types';

import { ServiceAccountToken } from '../components/CreateTokenModal';

import {
  acOptionsLoaded,
  pageChanged,
  queryChanged,
  rolesFetchBegin,
  rolesFetchEnd,
  serviceAccountsFetchBegin,
  serviceAccountsFetched,
  serviceAccountsFetchEnd,
  stateFilterChanged,
} from './reducers';

const BASE_URL = `/api/serviceaccounts`;

export function fetchACOptions(): ThunkResult<void> {
  return async (dispatch) => {
    try {
      if (contextSrv.licensedAccessControlEnabled() && contextSrv.hasPermission(AccessControlAction.ActionRolesList)) {
        const options = await fetchRoleOptions();
        dispatch(acOptionsLoaded(options));
      }
    } catch (error) {
      console.error(error);
    }
  };
}

interface FetchServiceAccountsParams {
  withLoadingIndicator: boolean;
}

export function fetchServiceAccounts(
  { withLoadingIndicator }: FetchServiceAccountsParams = { withLoadingIndicator: false }
): ThunkResult<void> {
  return async (dispatch, getState) => {
    try {
      if (contextSrv.hasPermission(AccessControlAction.ServiceAccountsRead)) {
        if (withLoadingIndicator) {
          dispatch(serviceAccountsFetchBegin());
        }
        const { perPage, page, query, serviceAccountStateFilter } = getState().serviceAccounts;
        const result = await getBackendSrv().get(
          `/api/serviceaccounts/search?perpage=${perPage}&page=${page}&query=${query}${getStateFilter(
            serviceAccountStateFilter
          )}&accesscontrol=true`
        );

        if (
          contextSrv.licensedAccessControlEnabled() &&
          contextSrv.hasPermission(AccessControlAction.ActionUserRolesList)
        ) {
          dispatch(rolesFetchBegin());
          const orgId = contextSrv.user.orgId;
          const userIds = result?.serviceAccounts.map((u: ServiceAccountDTO) => u.id);
          const roles = await getBackendSrv().post(`/api/access-control/users/roles/search`, { userIds, orgId });
          result.serviceAccounts.forEach((u: ServiceAccountDTO) => {
            u.roles = roles ? roles[u.id] || [] : [];
          });
          dispatch(rolesFetchEnd());
        }

        dispatch(serviceAccountsFetched(result));
      }
    } catch (error) {
      console.error(error);
    } finally {
      dispatch(serviceAccountsFetchEnd());
    }
  };
}

const fetchServiceAccountsWithDebounce = debounce((dispatch) => dispatch(fetchServiceAccounts()), 500, {
  leading: true,
});

export function updateServiceAccount(serviceAccount: ServiceAccountDTO): ThunkResult<void> {
  return async (dispatch) => {
    await getBackendSrv().patch(`${BASE_URL}/${serviceAccount.uid}?accesscontrol=true`, {
      ...serviceAccount,
    });
    dispatch(fetchServiceAccounts());
  };
}

export function deleteServiceAccount(serviceAccountUid: string): ThunkResult<void> {
  return async (dispatch) => {
    await getBackendSrv().delete(`${BASE_URL}/${serviceAccountUid}`);
    dispatch(fetchServiceAccounts());
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
    dispatch(fetchServiceAccounts());
  };
}

// search / filtering of serviceAccounts
const getStateFilter = (value: ServiceAccountStateFilter) => {
  switch (value) {
    case ServiceAccountStateFilter.WithExpiredTokens:
      return '&expiredTokens=true';
    case ServiceAccountStateFilter.Disabled:
      return '&disabled=true';
    case ServiceAccountStateFilter.External:
      return '&external=true';
    default:
      return '';
  }
};

export function changeQuery(query: string): ThunkResult<void> {
  return async (dispatch) => {
    dispatch(queryChanged(query));
    fetchServiceAccountsWithDebounce(dispatch);
  };
}

export function changeStateFilter(filter: ServiceAccountStateFilter): ThunkResult<void> {
  return async (dispatch) => {
    dispatch(stateFilterChanged(filter));
    dispatch(fetchServiceAccounts());
  };
}

export function changePage(page: number): ThunkResult<void> {
  return async (dispatch) => {
    dispatch(pageChanged(page));
    dispatch(fetchServiceAccounts());
  };
}
