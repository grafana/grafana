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

const enhancedAPI = generatedAPI.enhanceEndpoints({
  endpoints: {
    listUserRoles: {
      transformResponse: transformRolesResponse,
      transformErrorResponse: transformRolesError,
    },
    listRoles: {
      transformResponse: transformRolesResponse,
    },
  },
});

// Then inject listTeamRoles endpoint that has type compatibility issues with the generated API.
// On generated API the `SuccessResponseBody` is returned. However, the current implementation returns a `RoleDto[]`.
// This incompatibility will be resolved later.
export const rolesAPI = enhancedAPI.injectEndpoints({
  overrideExisting: true,
  endpoints: (build) => ({
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
  }),
});

export const {
  useListTeamRolesQuery,
  useSetTeamRolesMutation,
  useListUserRolesQuery,
  useSetUserRolesMutation,
  useListRolesQuery,
} = rolesAPI;
