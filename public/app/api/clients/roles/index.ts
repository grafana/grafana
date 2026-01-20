import { createApi } from '@reduxjs/toolkit/query/react';

import { createBaseQuery } from '@grafana/api-clients/rtkq';
import { isFetchError } from '@grafana/runtime';
import { addDisplayNameForFixedRole, addFilteredDisplayName } from 'app/core/utils/roles';
import { Role } from 'app/types/accessControl';

interface FetchTeamRolesArgs {
  teamId: number;
  orgId?: number;
}

interface UpdateTeamRolesArgs {
  teamId: number;
  roles: Role[];
  orgId?: number;
}

interface FetchRoleOptionsArgs {
  orgId?: number;
}

interface FetchUserRolesArgs {
  userId: number;
  orgId?: number;
}

interface UpdateUserRolesArgs {
  userId: number;
  roles: Role[];
  orgId?: number;
}

export const rolesAPI = createApi({
  reducerPath: 'rolesAPI',
  baseQuery: createBaseQuery({ baseURL: '/api' }),
  tagTypes: ['TeamRoles', 'UserRoles', 'RoleOptions'],
  endpoints: (builder) => ({
    fetchTeamRoles: builder.query<Role[], FetchTeamRolesArgs>({
      query: ({ teamId, orgId }) => ({
        url: `/access-control/teams/${teamId}/roles`,
        params: orgId ? { targetOrgId: orgId } : undefined,
      }),
      providesTags: (result, error, { teamId }) => [{ type: 'TeamRoles', id: teamId }],
      transformResponse: (response: Role[] | null) => {
        if (!response || !response.length) {
          return [];
        }
        return response.map(addDisplayNameForFixedRole).map(addFilteredDisplayName);
      },
      transformErrorResponse: (error) => {
        if (isFetchError(error)) {
          error.isHandled = true;
        }
        return error;
      },
    }),

    updateTeamRoles: builder.mutation<void, UpdateTeamRolesArgs>({
      query: ({ teamId, roles, orgId }) => {
        const roleUids = roles.flatMap((x) => x.uid);
        return {
          url: `/access-control/teams/${teamId}/roles`,
          method: 'PUT',
          body: {
            orgId,
            roleUids,
          },
          params: orgId ? { targetOrgId: orgId } : undefined,
        };
      },
      invalidatesTags: (result, error, { teamId }) => [{ type: 'TeamRoles', id: teamId }],
    }),

    fetchUserRoles: builder.query<Role[], FetchUserRolesArgs>({
      query: ({ userId, orgId }) => ({
        url: `/access-control/users/${userId}/roles`,
        params: {
          includeMapped: true,
          includeHidden: true,
          ...(orgId && { targetOrgId: orgId }),
        },
      }),
      providesTags: (result, error, { userId }) => [{ type: 'UserRoles', id: userId }],
      transformResponse: (response: Role[] | null) => {
        if (!response || !response.length) {
          return [];
        }
        return response.map(addDisplayNameForFixedRole).map(addFilteredDisplayName);
      },
      transformErrorResponse: (error) => {
        if (isFetchError(error)) {
          error.isHandled = true;
        }
        return error;
      },
    }),

    updateUserRoles: builder.mutation<void, UpdateUserRolesArgs>({
      query: ({ userId, roles, orgId }) => {
        const filteredRoles = roles.filter((role) => !role.mapped);
        const roleUids = filteredRoles.flatMap((x) => x.uid);
        return {
          url: `/access-control/users/${userId}/roles`,
          method: 'PUT',
          body: {
            orgId,
            roleUids,
          },
          params: orgId ? { targetOrgId: orgId } : undefined,
        };
      },
      invalidatesTags: (result, error, { userId }) => [{ type: 'UserRoles', id: userId }],
    }),

    fetchRoleOptions: builder.query<Role[], FetchRoleOptionsArgs>({
      query: ({ orgId }) => ({
        url: '/access-control/roles',
        params: {
          delegatable: true,
          ...(orgId && { targetOrgId: orgId }),
        },
      }),
      providesTags: ['RoleOptions'],
      transformResponse: (response: Role[] | null) => {
        if (!response || !response.length) {
          return [];
        }
        return response.map(addDisplayNameForFixedRole).map(addFilteredDisplayName);
      },
    }),
  }),
});

export const {
  useFetchTeamRolesQuery,
  useUpdateTeamRolesMutation,
  useFetchUserRolesQuery,
  useUpdateUserRolesMutation,
  useFetchRoleOptionsQuery,
} = rolesAPI;
