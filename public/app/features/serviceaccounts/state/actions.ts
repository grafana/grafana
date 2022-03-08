import { ApiKey, ServiceAccountDTO, ThunkResult, ServiceAccountFilter } from '../../../types';
import { getBackendSrv, locationService } from '@grafana/runtime';
import {
  acOptionsLoaded,
  builtInRolesLoaded,
  filterChanged,
  pageChanged,
  queryChanged,
  serviceAccountLoaded,
  serviceAccountsFetchBegin,
  serviceAccountsFetchEnd,
  serviceAccountsFetched,
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

export function updateServiceAccount(serviceAccount: ServiceAccountDTO): ThunkResult<void> {
  return async (dispatch) => {
    const response = await getBackendSrv().patch(`${BASE_URL}/${serviceAccount.id}`, { ...serviceAccount });
    dispatch(serviceAccountLoaded(response));
  };
}

export function removeServiceAccount(serviceAccountId: number): ThunkResult<void> {
  return async (dispatch) => {
    await getBackendSrv().delete(`${BASE_URL}/${serviceAccountId}`);
    dispatch(fetchServiceAccounts());
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
  return async (dispatch, getState) => {
    try {
      const { perPage, page, query, filters } = getState().serviceAccounts;
      const result = await getBackendSrv().get(
        `/api/serviceaccounts/search?perpage=${perPage}&page=${page}&query=${query}&${getFilters(
          filters
        )}&accesscontrol=true`
      );
      dispatch(serviceAccountsFetched(result));
    } catch (error) {
      serviceAccountsFetchEnd();
      console.error(error);
    }
  };
}

const fetchServiceAccountsWithDebounce = debounce((dispatch) => dispatch(fetchServiceAccounts()), 500);

export function changeQuery(query: string): ThunkResult<void> {
  return async (dispatch) => {
    dispatch(serviceAccountsFetchBegin());
    dispatch(queryChanged(query));
    fetchServiceAccountsWithDebounce(dispatch);
  };
}

export function changeFilter(filter: ServiceAccountFilter): ThunkResult<void> {
  return async (dispatch) => {
    dispatch(serviceAccountsFetchBegin());
    dispatch(filterChanged(filter));
    fetchServiceAccountsWithDebounce(dispatch);
  };
}

export function changePage(page: number): ThunkResult<void> {
  return async (dispatch) => {
    dispatch(serviceAccountsFetchBegin());
    dispatch(pageChanged(page));
    dispatch(fetchServiceAccounts());
  };
}

export function deleteServiceAccount(serviceAccountId: number): ThunkResult<void> {
  return async (dispatch) => {
    await getBackendSrv().delete(`${BASE_URL}/${serviceAccountId}`);
    locationService.push('/org/serviceaccounts');
  };
}
