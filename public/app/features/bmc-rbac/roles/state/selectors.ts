import { BMCRole, BMCRolesState } from 'app/types';

export const getSearchRoleQuery = (state: BMCRolesState) => state.searchRoleQuery;

export const getRoles = (state: BMCRolesState) => {
  const regex = new RegExp(state.searchRoleQuery, 'i');

  return state.roles.filter((role) => {
    return regex.test(role.name);
  });
};

export const sortedRoles = (roles: BMCRole[]) => {
  return roles.sort((a, b) => {
    if (a.systemRole && !b.systemRole) {
      return -1;
    }
    if (!a.systemRole && b.systemRole) {
      return 1;
    }
    return 0;
  });
};
