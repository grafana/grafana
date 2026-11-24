import { type DefinitionsFromApi, type OverrideResultType } from '@reduxjs/toolkit/query';

import {
  generatedAPI,
  type SetTeamRolesApiArg,
  type CreateTeamApiArg,
  type GetOrgUsersForCurrentOrgApiArg,
  type GetUserByIdApiArg,
} from '@grafana/api-clients/internal/rtkq/legacy';
import { type RequestOptions } from '@grafana/api-clients/rtkq';
import { type SyncInfo } from 'app/types/ldap';
import { type OrgUser, type UserDTO, type UserOrg, type UserSession } from 'app/types/user';

type Definitions = DefinitionsFromApi<typeof generatedAPI>;
// The OpenAPI spec leaves every field of these responses optional, and types auth tokens as the internal model.
type UserDefinitions = {
  getUserById: OverrideResultType<Definitions['getUserById'], UserDTO>;
  getUserOrgList: OverrideResultType<Definitions['getUserOrgList'], UserOrg[]>;
  getOrgUsersForCurrentOrg: OverrideResultType<Definitions['getOrgUsersForCurrentOrg'], OrgUser[]>;
  adminGetUserAuthTokens: OverrideResultType<Definitions['adminGetUserAuthTokens'], UserSession[]>;
  getSyncStatus: OverrideResultType<Definitions['getSyncStatus'], SyncInfo>;
};

/**
 * Asks the backend for the caller's permissions on each returned user.
 * The OpenAPI spec does not declare the parameter, so the generated query cannot send it.
 */
function withAccessControlMetadata<ApiArg, Def extends { query?: (arg: ApiArg) => RequestOptions }>(
  endpointDefinition: Def
) {
  const originalQuery = endpointDefinition.query;
  if (!originalQuery) {
    return;
  }

  endpointDefinition.query = (queryArg: ApiArg) => {
    const requestOptions = originalQuery(queryArg);
    return { ...requestOptions, params: { ...requestOptions.params, accesscontrol: true } };
  };
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
    adminUpdateUserPermissions: { invalidatesTags: ['admin_users', 'users'] },
    adminDisableUser: { invalidatesTags: ['admin_users', 'users'] },
    adminEnableUser: { invalidatesTags: ['admin_users', 'users'] },
    updateOrgUser: { invalidatesTags: ['orgs', 'org', 'users'] },
    updateOrgUserForCurrentOrg: { invalidatesTags: ['org', 'users'] },
    addOrgUser: { invalidatesTags: ['orgs', 'org', 'users'] },
    removeOrgUser: { invalidatesTags: ['orgs', 'org', 'users'] },
    postSyncUserWithLdap: { invalidatesTags: ['admin_ldap', 'org', 'users'] },
    // Users also change outside this cache (the Users list, a deletion), so these two reads are
    // dropped as soon as no page uses them. A later visit reads the user again.
    getUserById: (endpointDefinition) => {
      withAccessControlMetadata<GetUserByIdApiArg, typeof endpointDefinition>(endpointDefinition);
      endpointDefinition.keepUnusedDataFor = 0;
    },
    getOrgUsersForCurrentOrg: (endpointDefinition) => {
      withAccessControlMetadata<GetOrgUsersForCurrentOrgApiArg, typeof endpointDefinition>(endpointDefinition);
      endpointDefinition.keepUnusedDataFor = 0;
    },
    createTeam: (endpointDefinition) => {
      withSuccessAlertCheck<CreateTeamApiArg, typeof endpointDefinition>(endpointDefinition);
    },
    setTeamRoles: (endpointDefinition) => {
      withSuccessAlertCheck<SetTeamRolesApiArg, typeof endpointDefinition>(endpointDefinition);
    },
  },
});

// The generated hooks, typed with the response overrides above.
export const {
  useGetUserByIdQuery,
  useGetUserOrgListQuery,
  useGetOrgUsersForCurrentOrgQuery,
  useAdminGetUserAuthTokensQuery,
  useGetSyncStatusQuery,
} = legacyAPI;

// eslint-disable-next-line no-barrel-files/no-barrel-files
export * from '@grafana/api-clients/internal/rtkq/legacy';
