import { generatedAPI, type Team } from '@grafana/api-clients/rtkq/iam/v0alpha1';
import { rolesAPI } from 'app/api/clients/roles';

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
