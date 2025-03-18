import { UrlQueryValue } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/core';
import { accessControlQueryParam } from 'app/core/utils/accessControl';
import { OrgUser, AccessControlAction } from 'app/types';

const perPage = 30;

export const getOrg = async (orgId: UrlQueryValue) => {
  return await getBackendSrv().get(`/api/orgs/${orgId}`);
};

export const getOrgUsers = async (orgId: UrlQueryValue, page: number) => {
  if (contextSrv.hasPermission(AccessControlAction.OrgUsersRead)) {
    return getBackendSrv().get(`/api/orgs/${orgId}/users/search`, accessControlQueryParam({ perpage: perPage, page }));
  }
  return { orgUsers: [] };
};

export const getUsersRoles = async (orgId: number, users: OrgUser[]) => {
  const userIds = users.map((u) => u.userId);
  const roles = await getBackendSrv().post(`/api/access-control/users/roles/search?includeMapped=true`, {
    userIds,
    orgId,
  });
  users.forEach((u) => {
    u.roles = roles ? roles[u.userId] || [] : [];
  });
};

export const updateOrgUserRole = (orgUser: OrgUser, orgId: UrlQueryValue) => {
  return getBackendSrv().patch(`/api/orgs/${orgId}/users/${orgUser.userId}`, orgUser);
};

export const removeOrgUser = (orgUser: OrgUser, orgId: UrlQueryValue) => {
  return getBackendSrv().delete(`/api/orgs/${orgId}/users/${orgUser.userId}`);
};

export const updateOrgName = (name: string, orgId: number) => {
  return getBackendSrv().put(`/api/orgs/${orgId}`, { name });
};
