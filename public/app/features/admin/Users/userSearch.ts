import { getBackendSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { accessControlQueryParam } from 'app/core/utils/accessControl';
import { AccessControlAction, type Role } from 'app/types/accessControl';
import { type OrgUser, type UserDTO, type UserFilter } from 'app/types/user';

export interface UserSearchOptions {
  query: string;
  sort?: string;
  filters?: UserFilter[];
}

interface UserPageOptions extends UserSearchOptions {
  page: number;
  perPage: number;
}

interface PageInfo {
  page: number;
  perPage: number;
  totalCount: number;
}

export function getUsersPage(options: UserPageOptions): Promise<PageInfo & { users: UserDTO[] }> {
  return getBackendSrv().get(getUsersSearchUrl(options));
}

export function getOrgUsers({
  perPage,
  page,
  query,
  sort,
}: Omit<UserPageOptions, 'filters'>): Promise<PageInfo & { orgUsers: OrgUser[] }> {
  return getBackendSrv().get('/api/org/users/search', accessControlQueryParam({ perpage: perPage, page, query, sort }));
}

export function canShowRoles(): boolean {
  return contextSrv.licensedAccessControlEnabled() && contextSrv.hasPermission(AccessControlAction.ActionUserRolesList);
}

export function getUserRoles(userIds: number[]): Promise<Record<number, Role[]>> {
  return getBackendSrv().post('/api/access-control/users/roles/search?includeMapped=true', {
    userIds,
    orgId: contextSrv.user.orgId,
  });
}

function getUsersSearchUrl({ query, sort, filters = [], page, perPage }: UserPageOptions) {
  const params = new URLSearchParams({ perpage: String(perPage), page: String(page), query });
  for (const filter of filters) {
    const values = Array.isArray(filter.value) ? filter.value.map((value) => value.value) : [filter.value];
    for (const value of values) {
      params.append(String(filter.name), String(value));
    }
  }
  if (sort) {
    params.set('sort', sort);
  }
  return `/api/users/search?${params}`;
}
