import { type DefinitionsFromApi, type OverrideResultType } from '@reduxjs/toolkit/query';

import {
  generatedAPI,
  type SetTeamRolesApiArg,
  type CreateTeamApiArg,
} from '@grafana/api-clients/internal/rtkq/legacy';
import { type RequestOptions } from '@grafana/api-clients/rtkq';
import { generatedAPI as iamAPI } from '@grafana/api-clients/rtkq/iam/v0alpha1';
import { type SyncInfo } from 'app/types/ldap';
import { type OrgUser, type UserDTO, type UserOrg, type UserSession } from 'app/types/user';

type Definitions = DefinitionsFromApi<typeof generatedAPI>;
type UserDefinitions = {
  getUserById: OverrideResultType<Definitions['getUserById'], UserDTO & { createdAt?: string }>;
  getUserOrgList: OverrideResultType<Definitions['getUserOrgList'], UserOrg[]>;
  getOrgUsersForCurrentOrg: OverrideResultType<Definitions['getOrgUsersForCurrentOrg'], OrgUser[]>;
  adminGetUserAuthTokens: OverrideResultType<Definitions['adminGetUserAuthTokens'], UserSession[]>;
  getSyncStatus: OverrideResultType<Definitions['getSyncStatus'], SyncInfo>;
};

async function invalidateIAMUser(
  _arg: unknown,
  { dispatch, queryFulfilled }: Parameters<NonNullable<Definitions['updateUser']['onQueryStarted']>>[1]
) {
  try {
    await queryFulfilled;
    // User management still writes through legacy routes while readers can use IAM.
    dispatch(iamAPI.util.invalidateTags(['User']));
  } catch {
    // The mutation result exposes failures to the caller; failed writes change no data.
  }
}

/**
 * Adds a check to the endpoint that will pass on the showSuccessAlert property to the backend_srv. This way it's
 * possible to disable the automatic toast that some of the legacy endpoints produce.
 * @param endpointDefinition
 */
function withSuccessAlertCheck<ApiArg extends {}, Def extends { query?: (arg: ApiArg) => RequestOptions }>(
  endpointDefinition: Def
) {
  const originalQuery = endpointDefinition.query;
  if (!originalQuery) {
    return;
  }

  endpointDefinition.query = (queryArg: ApiArg) => {
    const requestOptions = originalQuery(queryArg);

    const showSuccessAlert = 'showSuccessAlert' in queryArg ? Boolean(queryArg.showSuccessAlert) : undefined;
    return {
      ...requestOptions,
      // Because createTeam API returns a message prop in the response, it would always generate a success toast
      // which may not be always wanted.
      ...(showSuccessAlert !== undefined && { showSuccessAlert }),
    };
  };
}

export const legacyAPI = generatedAPI.enhanceEndpoints<never, UserDefinitions>({
  endpoints: {
    updateUser: { onQueryStarted: invalidateIAMUser },
    adminDisableUser: { onQueryStarted: invalidateIAMUser, invalidatesTags: ['admin_users', 'users'] },
    adminEnableUser: { onQueryStarted: invalidateIAMUser, invalidatesTags: ['admin_users', 'users'] },
    adminUpdateUserPermissions: { onQueryStarted: invalidateIAMUser, invalidatesTags: ['admin_users', 'users'] },
    updateOrgUser: { onQueryStarted: invalidateIAMUser, invalidatesTags: ['orgs', 'org', 'users'] },
    updateOrgUserForCurrentOrg: { onQueryStarted: invalidateIAMUser, invalidatesTags: ['org', 'users'] },
    addOrgUser: { onQueryStarted: invalidateIAMUser, invalidatesTags: ['orgs', 'org', 'users'] },
    removeOrgUser: { onQueryStarted: invalidateIAMUser, invalidatesTags: ['orgs', 'org', 'users'] },
    postSyncUserWithLdap: { onQueryStarted: invalidateIAMUser, invalidatesTags: ['admin_ldap', 'org', 'users'] },
    getUserById: (definition) => {
      const query = definition.query!;
      definition.query = (arg) => ({ ...query(arg), params: { accesscontrol: true } });
    },
    getOrgUsersForCurrentOrg: (definition) => {
      const query = definition.query!;
      definition.query = (arg) => {
        const options = query(arg);
        return { ...options, params: { ...options.params, accesscontrol: true } };
      };
    },
    adminGetUserAuthTokens: {
      transformResponse: (sessions: UserSession[]) => [...sessions].reverse(),
    },
    createTeam: (endpointDefinition) => {
      withSuccessAlertCheck<CreateTeamApiArg, typeof endpointDefinition>(endpointDefinition);
    },
    setTeamRoles: (endpointDefinition) => {
      withSuccessAlertCheck<SetTeamRolesApiArg, typeof endpointDefinition>(endpointDefinition);
    },
  },
});

export const {
  useGetUserByIdQuery,
  useGetUserOrgListQuery,
  useGetOrgUsersForCurrentOrgQuery,
  useAdminGetUserAuthTokensQuery,
  useGetSyncStatusQuery,
  useUpdateUserMutation,
  useAdminUpdateUserPasswordMutation,
  useAdminUpdateUserPermissionsMutation,
  useAdminDeleteUserMutation,
  useAdminDisableUserMutation,
  useAdminEnableUserMutation,
  useAdminLogoutUserMutation,
  useAdminRevokeUserAuthTokenMutation,
  useRemoveOrgUserMutation,
  useUpdateOrgUserMutation,
} = legacyAPI;

// eslint-disable-next-line no-barrel-files/no-barrel-files
export * from '@grafana/api-clients/internal/rtkq/legacy';
