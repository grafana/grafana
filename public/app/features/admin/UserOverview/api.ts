import { generatedAPI, type Team, type User } from '@grafana/api-clients/rtkq/iam/v0alpha1';
import { dateTimeFormatTimeAgo, type OrgRole } from '@grafana/data';
import { getBackendSrv, isFetchError } from '@grafana/runtime';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { legacyAPI } from 'app/api/clients/legacy';
import { rolesAPI } from 'app/api/clients/roles';
import config from 'app/core/config';
import { contextSrv } from 'app/core/services/context_srv';
import { discoveryResources, getAPIGroupDiscoveryList } from 'app/features/apiserver/discovery';
import { AccessControlAction } from 'app/types/accessControl';
import { type SyncInfo } from 'app/types/ldap';
import { type Team as LegacyTeam } from 'app/types/teams';
import { type OrgUser, type UserDTO, type UserOrg, type UserSession } from 'app/types/user';

export type OverviewProfile = UserDTO & { createdAt?: string };

const managementAPI = legacyAPI.injectEndpoints({
  endpoints: (build) => ({
    getOverviewProfile: build.query<OverviewProfile, string>({
      query: (uid) => ({ url: `/users/${uid}`, params: { accesscontrol: true } }),
      providesTags: ['users'],
    }),
    getOverviewOrgs: build.query<UserOrg[], string>({
      query: (uid) => ({ url: `/users/${uid}/orgs` }),
      providesTags: ['users'],
    }),
    getOverviewOrgUsers: build.query<OrgUser[], string>({
      query: (login) => ({ url: '/org/users', params: { query: login, accesscontrol: true } }),
      providesTags: ['org'],
    }),
    getOverviewSessions: build.query<Array<UserSession & { seenAtTimestamp: number }>, string>({
      query: (uid) => ({ url: `/admin/users/${uid}/auth-tokens` }),
      transformResponse: (sessions: UserSession[]) =>
        [...sessions].reverse().map((session) => ({
          ...session,
          seenAtTimestamp: new Date(session.seenAt).getTime(),
          seenAt: dateTimeFormatTimeAgo(session.seenAt),
        })),
    }),
    getOverviewLdapStatus: build.query<SyncInfo, void>({
      query: () => ({ url: '/admin/ldap-sync-status' }),
    }),
    updateOverviewProfile: build.mutation<void, { uid: string; profile: Pick<UserDTO, 'name' | 'email' | 'login'> }>({
      query: ({ uid, profile }) => ({ url: `/users/${uid}`, method: 'PUT', body: profile }),
    }),
    updateOverviewPassword: build.mutation<void, { uid: string; password: string }>({
      query: ({ uid, password }) => ({ url: `/admin/users/${uid}/password`, method: 'PUT', body: { password } }),
    }),
    updateOverviewAdmin: build.mutation<void, { uid: string; isGrafanaAdmin: boolean }>({
      query: ({ uid, isGrafanaAdmin }) => ({
        url: `/admin/users/${uid}/permissions`,
        method: 'PUT',
        body: { isGrafanaAdmin },
      }),
    }),
    deleteOverviewUser: build.mutation<void, string>({
      query: (uid) => ({ url: `/admin/users/${uid}`, method: 'DELETE' }),
    }),
    disableOverviewUser: build.mutation<void, string>({
      query: (uid) => ({ url: `/admin/users/${uid}/disable`, method: 'POST' }),
    }),
    enableOverviewUser: build.mutation<void, string>({
      query: (uid) => ({ url: `/admin/users/${uid}/enable`, method: 'POST' }),
    }),
    addOverviewOrgUser: build.mutation<void, { orgId: number; loginOrEmail: string; role: OrgRole }>({
      query: ({ orgId, loginOrEmail, role }) => ({
        url: `/orgs/${orgId}/users/`,
        method: 'POST',
        body: { loginOrEmail, role },
      }),
    }),
    removeOverviewOrgUser: build.mutation<void, { orgId: number; uid: string }>({
      query: ({ orgId, uid }) => ({ url: `/orgs/${orgId}/users/${uid}`, method: 'DELETE' }),
    }),
    updateOverviewOrgRole: build.mutation<void, { orgId: number; uid: string; role: OrgRole }>({
      query: ({ orgId, uid, role }) => ({ url: `/orgs/${orgId}/users/${uid}`, method: 'PATCH', body: { role } }),
    }),
    updateOverviewBasicRole: build.mutation<void, { userId: number; role: OrgRole }>({
      query: ({ userId, role }) => ({ url: `/org/users/${userId}`, method: 'PATCH', body: { role } }),
    }),
    revokeOverviewSession: build.mutation<void, { uid: string; authTokenId: number }>({
      query: ({ uid, authTokenId }) => ({
        url: `/admin/users/${uid}/revoke-auth-token`,
        method: 'POST',
        body: { authTokenId },
      }),
    }),
    revokeOverviewSessions: build.mutation<void, string>({
      query: (uid) => ({ url: `/admin/users/${uid}/logout`, method: 'POST' }),
    }),
    syncOverviewLdapUser: build.mutation<void, number>({
      query: (userId) => ({ url: `/admin/ldap/sync/${userId}`, method: 'POST' }),
    }),
  }),
});

export const {
  useGetOverviewProfileQuery,
  useGetOverviewOrgsQuery,
  useGetOverviewOrgUsersQuery,
  useGetOverviewSessionsQuery,
  useGetOverviewLdapStatusQuery,
  useUpdateOverviewProfileMutation,
  useUpdateOverviewPasswordMutation,
  useUpdateOverviewAdminMutation,
  useDeleteOverviewUserMutation,
  useDisableOverviewUserMutation,
  useEnableOverviewUserMutation,
  useAddOverviewOrgUserMutation,
  useRemoveOverviewOrgUserMutation,
  useUpdateOverviewOrgRoleMutation,
  useUpdateOverviewBasicRoleMutation,
  useRevokeOverviewSessionMutation,
  useRevokeOverviewSessionsMutation,
  useSyncOverviewLdapUserMutation,
} = managementAPI;

export interface RoleAssignment {
  id: string;
  role: string;
  description?: string;
  type: 'direct' | 'team';
  team?: Team;
}

// Discover registered resources rather than relying on rollout flags: explicit IAM
// startup configuration can enable APIs independently of those flags.
const discoveryAPI = generatedAPI.injectEndpoints({
  endpoints: (build) => ({
    getOverviewCapabilities: build.query<{ users: boolean; userTeams: boolean }, void>({
      async queryFn() {
        try {
          const resources = discoveryResources(await getAPIGroupDiscoveryList()).filter(
            (resource) =>
              resource.responseKind.group === 'iam.grafana.app' && resource.responseKind.version === 'v0alpha1'
          );
          const users = resources.find((resource) => resource.resource === 'users');
          return {
            data: {
              users: !!users?.verbs.includes('get'),
              userTeams:
                !!users?.subresources?.some(
                  (resource) => resource.subresource === 'teams' && resource.verbs.includes('get')
                ) && resources.some((resource) => resource.resource === 'teams' && resource.verbs.includes('get')),
            },
          };
        } catch (error) {
          // Older servers may not expose discovery. Authorization and transient
          // failures must remain visible rather than silently switching backends.
          if (isFetchError(error) && error.status === 404) {
            return { data: { users: false, userTeams: false } };
          }
          return { error };
        }
      },
    }),
  }),
});

const overviewAPI = generatedAPI.injectEndpoints({
  endpoints: (build) => ({
    getOverviewUser: build.query<{ user: User; hasLastSeen: boolean }, string>({
      async queryFn(uid, api) {
        try {
          // kubernetesUsersApi is LegacyFrontend-only until its backend registry entry is migrated.
          // eslint-disable-next-line @grafana/no-config-feature-toggles
          const capabilities = config.featureToggles.kubernetesUsersApi
            ? await api
                .dispatch(discoveryAPI.endpoints.getOverviewCapabilities.initiate(undefined, { subscribe: false }))
                .unwrap()
            : { users: false };
          if (capabilities.users) {
            const user = await api
              .dispatch(
                generatedAPI.endpoints.getUser.initiate({ name: uid }, { subscribe: false, forceRefetch: true })
              )
              .unwrap();
            return { data: { user, hasLastSeen: true } };
          }
          const canReadProfile = contextSrv.hasPermission(AccessControlAction.UsersRead);
          const profile = canReadProfile
            ? await api
                .dispatch(
                  managementAPI.endpoints.getOverviewProfile.initiate(uid, { subscribe: false, forceRefetch: true })
                )
                .unwrap()
            : undefined;
          const members = contextSrv.hasPermission(AccessControlAction.OrgUsersRead)
            ? await api
                .dispatch(
                  managementAPI.endpoints.getOverviewOrgUsers.initiate(profile?.login ?? '', {
                    subscribe: false,
                    forceRefetch: true,
                  })
                )
                .unwrap()
            : [];
          const member = members.find((member) => member.uid === uid);
          if (!profile && !member) {
            return { error: { status: 404 } };
          }
          const orgs =
            profile && !member
              ? await api
                  .dispatch(
                    managementAPI.endpoints.getOverviewOrgs.initiate(uid, { subscribe: false, forceRefetch: true })
                  )
                  .unwrap()
              : [];
          return {
            data: {
              user: {
                metadata: {
                  name: uid,
                  creationTimestamp: profile?.createdAt ?? profile?.created ?? member?.created,
                  labels: { 'grafana.app/deprecatedInternalID': String(profile?.id ?? member?.userId) },
                },
                spec: {
                  login: profile?.login ?? member!.login,
                  title: profile?.name ?? member!.name,
                  email: profile?.email ?? member!.email,
                  role: member?.role ?? orgs.find((org) => org.orgId === contextSrv.user.orgId)?.role ?? '',
                  grafanaAdmin: profile?.isGrafanaAdmin ?? false,
                  disabled: profile?.isDisabled ?? member!.isDisabled,
                  provisioned: !!(profile?.isProvisioned ?? member?.isProvisioned),
                  emailVerified: false,
                },
                status: { lastSeenAt: 0 },
              },
              hasLastSeen: false,
            },
          };
        } catch (error) {
          return { error };
        }
      },
      providesTags: ['User'],
    }),
    getOverviewTeams: build.query<Team[], string>({
      async queryFn(uid, api) {
        try {
          const capabilities = getFeatureFlagClient().getBooleanValue(FlagKeys.KubernetesTeamsApi, false)
            ? await api
                .dispatch(discoveryAPI.endpoints.getOverviewCapabilities.initiate(undefined, { subscribe: false }))
                .unwrap()
            : { userTeams: false };
          if (!capabilities.userTeams) {
            const teams = await getBackendSrv().get<LegacyTeam[]>(`/api/users/${uid}/teams`);
            return {
              data: teams.map(
                (team): Team => ({
                  metadata: { name: team.uid, labels: { 'grafana.app/deprecatedInternalID': String(team.id) } },
                  spec: {
                    title: team.name,
                    email: team.email ?? '',
                    provisioned: !!team.isProvisioned,
                    externalUID: '',
                    members: [],
                  },
                })
              ),
            };
          }
          const teams = new Set<string>();
          let next: string | undefined;
          do {
            const page = await api
              .dispatch(
                generatedAPI.endpoints.getUserTeams.initiate(
                  { name: uid, limit: 100, continue: next },
                  { subscribe: false, forceRefetch: true }
                )
              )
              .unwrap();
            page.items?.forEach((membership: { team: string }) => teams.add(membership.team));
            next = page.metadata?.continue;
          } while (next);

          const results = await Promise.all(
            [...teams].map((uid) =>
              api
                .dispatch(
                  generatedAPI.endpoints.getTeam.initiate({ name: uid }, { subscribe: false, forceRefetch: true })
                )
                .unwrap()
            )
          );
          const collator = new Intl.Collator();
          return { data: results.sort((a, b) => collator.compare(a.spec.title, b.spec.title)) };
        } catch (error) {
          return { error };
        }
      },
      providesTags: ['User', 'Team'],
    }),
  }),
});

const assignmentsAPI = rolesAPI.injectEndpoints({
  endpoints: (build) => ({
    getOverviewTeamRoles: build.query<
      { assignments: RoleAssignment[]; unavailableTeams: string[] },
      { teams: Team[]; orgId: number }
    >({
      async queryFn({ teams, orgId }, api) {
        const results = await Promise.all(
          teams.map(async (team) => {
            const teamId = Number(team.metadata.labels?.['grafana.app/deprecatedInternalID']);
            if (!teamId) {
              return { team, roles: undefined };
            }
            const result = await api.dispatch(
              rolesAPI.endpoints.listTeamRoles.initiate(
                { teamId, targetOrgId: orgId },
                { subscribe: false, forceRefetch: true }
              )
            );
            return { team, roles: result.data };
          })
        );
        return {
          data: {
            unavailableTeams: results.filter(({ roles }) => !roles).map(({ team }) => team.spec.title),
            assignments: results.flatMap(({ team, roles }) =>
              (roles ?? []).map((role) => ({
                id: `${team.metadata.name}:${role.uid}`,
                role: role.displayName || role.name,
                description: role.description,
                type: 'team' as const,
                team,
              }))
            ),
          },
        };
      },
      providesTags: ['access_control', 'enterprise'],
    }),
  }),
});

export const { useGetOverviewUserQuery, useGetOverviewTeamsQuery } = overviewAPI;
export const { useGetOverviewTeamRolesQuery } = assignmentsAPI;
