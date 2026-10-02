import { generatedAPI, type Team } from '@grafana/api-clients/rtkq/iam/v0alpha1';
import { dateTimeFormatTimeAgo } from '@grafana/data';
import { legacyAPI } from 'app/api/clients/legacy';
import { rolesAPI } from 'app/api/clients/roles';
import { type SyncInfo } from 'app/types/ldap';
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
  }),
});

export const {
  useGetOverviewProfileQuery,
  useGetOverviewOrgsQuery,
  useGetOverviewOrgUsersQuery,
  useGetOverviewSessionsQuery,
  useGetOverviewLdapStatusQuery,
} = managementAPI;

export interface RoleAssignment {
  id: string;
  role: string;
  description?: string;
  type: 'direct' | 'team';
  team?: Team;
}

const teamsAPI = generatedAPI.injectEndpoints({
  endpoints: (build) => ({
    getOverviewTeams: build.query<Team[], string>({
      async queryFn(uid, api) {
        try {
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

export const { useGetOverviewTeamsQuery } = teamsAPI;
export const { useGetOverviewTeamRolesQuery } = assignmentsAPI;
