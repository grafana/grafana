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

import { type WithUserUIDs } from './userEndpoints';

// The generated schema still describes these UID-compatible path parameters as numbers.
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const userUIDAPI = generatedAPI as WithUserUIDs<typeof generatedAPI>;
type Definitions = DefinitionsFromApi<typeof userUIDAPI>;
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

export const legacyAPI = userUIDAPI.enhanceEndpoints<never, UserDefinitions>({
  endpoints: {
    updateUser: { onQueryStarted: invalidateIAMUser },
    adminDisableUser: { onQueryStarted: invalidateIAMUser },
    adminEnableUser: { onQueryStarted: invalidateIAMUser },
    adminUpdateUserPermissions: { onQueryStarted: invalidateIAMUser },
    updateOrgUser: { onQueryStarted: invalidateIAMUser },
    updateOrgUserForCurrentOrg: { onQueryStarted: invalidateIAMUser },
    addOrgUser: { onQueryStarted: invalidateIAMUser },
    removeOrgUser: { onQueryStarted: invalidateIAMUser },
    postSyncUserWithLdap: { onQueryStarted: invalidateIAMUser },
    getUserById: (definition) => {
      const query = definition.query!;
      definition.query = (arg) => ({ ...query(arg), params: { accesscontrol: true } });
      definition.providesTags = ['users', 'admin_users', 'admin_ldap'];
    },
    getOrgUsersForCurrentOrg: (definition) => {
      const query = definition.query!;
      definition.query = (arg) => {
        const options = query(arg);
        return { ...options, params: { ...options.params, accesscontrol: true } };
      };
      definition.providesTags = ['org', 'orgs', 'admin_ldap'];
    },
    getUserOrgList: { providesTags: ['users', 'orgs', 'org', 'admin_ldap'] },
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
