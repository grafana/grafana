import { ServiceAccountDTO, ThunkResult, ServiceAccountFilter } from '../../../types';
import { getBackendSrv } from '@grafana/runtime';
import {
  acOptionsLoaded,
  builtInRolesLoaded,
  filterChanged,
  serviceAccountLoaded,
  serviceAccountsFetchEnd,
  serviceAccountsLoaded,
  serviceAccountTokensLoaded,
  serviceAccountToRemoveLoaded,
} from './reducers';
import { accessControlQueryParam } from 'app/core/utils/accessControl';
import { fetchBuiltinRoles, fetchRoleOptions } from 'app/core/components/RolePicker/api';
import { debounce } from 'lodash';

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
      const response = await getBackendSrv().get(`${BASE_URL}/${saID}`);
      dispatch(serviceAccountLoaded(response));
    } catch (error) {
      console.error(error);
    }
  };
}

export function createServiceAccountToken(
  saID: number,
  data: any,
  onTokenCreated: (key: string) => void
): ThunkResult<void> {
  return async (dispatch) => {
    const result = await getBackendSrv().post(`${BASE_URL}/${saID}/tokens`, data);
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

// search / filtering of serviceAccounts
const getFilters = (filters: ServiceAccountFilter[]) => {
  return filters
    .map((filter) => {
      if (Array.isArray(filter.value)) {
        return filter.value.map((v) => `${filter.name}=${v.value}`).join('&');
      }
      return `${filter.name}=${filter.value}`;
    })
    .join('&');
};

export function fetchServiceAccounts(): ThunkResult<void> {
  console.log(`fetchserviceaccounts`);
  return async (dispatch, getState) => {
    try {
      const { perPage, page, query, filters } = getState().serviceAccounts;
      const result = await getBackendSrv().get(
        `/api/serviceaccounts/search?perpage=${perPage}&page=${page}&query=${query}&${getFilters(filters)}`
      );
      console.log(`result`);
      console.log(result);
      dispatch(serviceAccountsLoaded(result));
    } catch (error) {
      serviceAccountsFetchEnd();
      console.error(error);
    }
  };
}

const fetchServiceAccountsWithDebounce = debounce((dispatch) => dispatch(fetchServiceAccounts()), 500);

export function changeFilter(filter: ServiceAccountFilter): ThunkResult<void> {
  return async (dispatch) => {
    dispatch(loadServiceAccounts());
    dispatch(filterChanged(filter));
    fetchServiceAccountsWithDebounce(dispatch);
  };
}
