import { FetchBaseQueryError } from '@reduxjs/toolkit/query';

import { generatedAPI, RoleDto } from '@grafana/api-clients/rtkq/legacy';
import { isFetchError } from '@grafana/runtime';
import { addDisplayNameForFixedRole, addFilteredDisplayName } from 'app/core/utils/roles';
import { Role } from 'app/types/accessControl';

const transformRolesResponse = (response: RoleDto[]): Role[] => {
  if (!response?.length) {
    return [];
  }
  return response.map(addFilteredDisplayName).map(addDisplayNameForFixedRole);
};

const transformRolesError = (error: FetchBaseQueryError) => {
  if (isFetchError(error)) {
    error.isHandled = true;
  }
  return error;
};

// rolesAPI is needed to be overriden to add transformResponse and transformErrorResponse for some endpoints.
export const rolesAPI = generatedAPI.injectEndpoints({
  overrideExisting: true,
  endpoints: (build) => ({
    listUserRoles: build.query<
      Role[],
      { userId: number; includeHidden?: boolean; includeMapped?: boolean; targetOrgId?: number }
    >({
      query: (queryArg) => ({
        url: `/access-control/users/${queryArg.userId}/roles`,
        params: {
          includeHidden: queryArg.includeHidden,
          includeMapped: queryArg.includeMapped,
          targetOrgId: queryArg.targetOrgId,
        },
      }),
      providesTags: ['access_control', 'enterprise'],
      transformResponse: transformRolesResponse,
      transformErrorResponse: transformRolesError,
    }),
    listTeamRoles: build.query<Role[], { teamId: number; includeHidden?: boolean; targetOrgId?: number }>({
      query: (queryArg) => ({
        url: `/access-control/teams/${queryArg.teamId}/roles`,
        params: {
          includeHidden: queryArg.includeHidden,
          targetOrgId: queryArg.targetOrgId,
        },
      }),
      providesTags: ['access_control', 'enterprise'],
      transformResponse: transformRolesResponse,
      transformErrorResponse: transformRolesError,
    }),
    listRoles: build.query<Role[], { delegatable?: boolean; includeHidden?: boolean; targetOrgId?: number }>({
      query: (queryArg) => ({
        url: '/access-control/roles',
        params: {
          delegatable: queryArg.delegatable,
          includeHidden: queryArg.includeHidden,
          targetOrgId: queryArg.targetOrgId,
        },
      }),
      providesTags: ['access_control', 'enterprise'],
      transformResponse: transformRolesResponse,
    }),
  }),
});

export const {
  useListTeamRolesQuery,
  useSetTeamRolesMutation,
  useListUserRolesQuery,
  useSetUserRolesMutation,
  useListRolesQuery,
} = rolesAPI;
