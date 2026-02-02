import { debounce } from 'lodash';

import { getBackendSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/core';
import { accessControlQueryParam } from 'app/core/utils/accessControl';
import { AccessControlAction, BMCRole, ThunkResult } from 'app/types';

import { rolesFetchBegin, rolesFetchEnd, rolesLoaded, searchQueryChanged, pageChanged } from './reducers';

export function loadRoles(initial = false): ThunkResult<void> {
  return async (dispatch, getState) => {
    try {
      const { searchRoleQuery: query, page, perPage } = getState().roles;
      // TODO: replace with right action for roles once it is created
      if (!contextSrv.hasPermission(AccessControlAction.ActionTeamsRead)) {
        dispatch(rolesLoaded({ roles: [], totalCount: 0, page: 1, perPage }));
        return;
      }

      const response = await getBackendSrv().get(
        '/api/rbac/roles',
        accessControlQueryParam({ query, page, perpage: perPage })
      );

      dispatch(rolesLoaded({ ...response }));
    } catch (error) {
    } finally {
      rolesFetchEnd();
    }
  };
}

export function createRole(role: BMCRole) {
  return getBackendSrv().post(`/api/rbac/roles/`, role);
}

export function updateRole(id: number, role: BMCRole) {
  return getBackendSrv().post(`/api/rbac/roles/${id}`, role);
}

export function deleteRole(id: number): ThunkResult<void> {
  return async (dispatch) => {
    await getBackendSrv().delete(`/api/rbac/roles/${id}`);
    dispatch(loadRoles());
  };
}

export function changePage(page: number): ThunkResult<void> {
  return async (dispatch) => {
    dispatch(pageChanged(page));
    dispatch(loadRoles());
  };
}

const fetchRolesWithDebounce = debounce((dispatch) => dispatch(loadRoles()), 300);

export function changeSearchQuery(query: string): ThunkResult<void> {
  return async (dispatch) => {
    dispatch(rolesFetchBegin());
    dispatch(searchQueryChanged(query));
    fetchRolesWithDebounce(dispatch);
  };
}

export async function loadRoleDetails(roleId: number) {
  // TODO: replace with right action for roles once it is created
  if (!contextSrv.hasPermission(AccessControlAction.ActionTeamsRead)) {
    return;
  }

  const response = await getBackendSrv().get(`/api/rbac/roles/${roleId}`);

  return response;
}
