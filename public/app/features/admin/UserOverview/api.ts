import { skipToken } from '@reduxjs/toolkit/query';

import { generatedAPI, type Team, useGetUserQuery } from '@grafana/api-clients/rtkq/iam/v0alpha1';
import { isFetchError } from '@grafana/runtime';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import {
  legacyAPI,
  useGetUserByIdQuery,
  useGetUserOrgListQuery,
  useGetOrgUsersForCurrentOrgQuery,
} from 'app/api/clients/legacy';
import config from 'app/core/config';
import { contextSrv } from 'app/core/services/context_srv';
import { discoveryResources, getAPIGroupDiscoveryList } from 'app/features/apiserver/discovery';
import { teamDtoToTeam } from 'app/features/teams/hooks';
import { AccessControlAction } from 'app/types/accessControl';
import { type UserDTO } from 'app/types/user';

export type OverviewUser = UserDTO & {
  role: string;
  createdAt?: string;
  lastSeenAt?: string;
  hasProfile: boolean;
  orgAccessControl?: UserDTO['accessControl'];
};

export interface RoleAssignment {
  id: string;
  role: string;
  description?: string;
  type: 'direct' | 'team';
  team?: Team;
}

// The users resource (including its teams subresource) requires single-organization
// mode. A rollout flag alone does not guarantee that these routes are registered.
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
    getOverviewTeams: build.query<Team[], string>({
      async queryFn(uid, api) {
        try {
          const capabilities = getFeatureFlagClient().getBooleanValue(FlagKeys.KubernetesTeamsApi, false)
            ? await api
                .dispatch(discoveryAPI.endpoints.getOverviewCapabilities.initiate(undefined, { subscribe: false }))
                .unwrap()
            : { userTeams: false };
          if (!capabilities.userTeams) {
            const teams = await api
              .dispatch(legacyAPI.endpoints.getUserTeams.initiate({ userId: uid }, { subscribe: false }))
              .unwrap();
            return { data: teams.map(teamDtoToTeam) };
          }
          const teams = new Set<string>();
          let next: string | undefined;
          do {
            const page = await api
              .dispatch(
                generatedAPI.endpoints.getUserTeams.initiate(
                  { name: uid, limit: 100, continue: next },
                  { subscribe: false }
                )
              )
              .unwrap();
            page.items?.forEach((membership: { team: string }) => teams.add(membership.team));
            next = page.metadata?.continue;
          } while (next);

          const results = await Promise.all(
            [...teams].map((uid) =>
              api.dispatch(generatedAPI.endpoints.getTeam.initiate({ name: uid }, { subscribe: false })).unwrap()
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

export const { useGetOverviewTeamsQuery } = overviewAPI;

export function useUserOverview(uid: string) {
  // These flags are LegacyFrontend-only until their backend registry entries are migrated.
  // eslint-disable-next-line @grafana/no-config-feature-toggles
  const enabled = config.featureToggles.kubernetesUsersApi;
  const discovery = discoveryAPI.useGetOverviewCapabilitiesQuery(enabled ? undefined : skipToken);
  const useIAM = enabled && discovery.currentData?.users;
  const iam = useGetUserQuery(useIAM ? { name: uid } : skipToken);
  const profileQuery = useGetUserByIdQuery(
    contextSrv.hasPermission(AccessControlAction.UsersRead) ? { userId: uid } : skipToken
  );
  const profile = profileQuery.currentData;
  const resource = iam.currentData;
  const login = profile?.login ?? resource?.spec.login;
  const members = useGetOrgUsersForCurrentOrgQuery(
    login && contextSrv.hasPermission(AccessControlAction.OrgUsersRead) ? { query: login, limit: 100 } : skipToken
  );
  const member = members.currentData?.find((member) => member.uid === uid);
  const orgs = useGetUserOrgListQuery(profile && !useIAM && !member ? { userId: uid } : skipToken);
  const user: OverviewUser | undefined =
    (!enabled || discovery.currentData) && !discovery.error && !iam.error && (profile || resource)
      ? {
          ...profile,
          id: profile?.id ?? Number(resource?.metadata.labels?.['grafana.app/deprecatedInternalID']),
          uid,
          login: login ?? '',
          name: profile?.name ?? resource?.spec.title ?? '',
          email: profile?.email ?? resource?.spec.email ?? '',
          role:
            member?.role ??
            resource?.spec.role ??
            orgs.currentData?.find((org) => org.orgId === contextSrv.user.orgId)?.role ??
            '',
          isGrafanaAdmin: profile?.isGrafanaAdmin ?? resource?.spec.grafanaAdmin ?? false,
          isDisabled: profile?.isDisabled ?? resource?.spec.disabled ?? false,
          isProvisioned: profile?.isProvisioned ?? resource?.spec.provisioned ?? false,
          isExternallySynced: member?.isExternallySynced ?? profile?.isExternallySynced,
          isExternal: profile ? !!profile.isExternal : !!resource?.spec.externalAuthInfo?.length,
          authLabels: profile?.authLabels ?? resource?.spec.externalAuthInfo?.map((auth) => auth.module),
          createdAt: resource?.metadata.creationTimestamp ?? profile?.createdAt ?? profile?.created,
          lastSeenAt: resource ? new Date((resource.status?.lastSeenAt ?? 0) * 1000).toISOString() : undefined,
          hasProfile: !!profile,
          orgAccessControl: member?.accessControl,
        }
      : undefined;
  return {
    user,
    isLoading: discovery.isFetching || iam.isFetching || profileQuery.isFetching,
    error: discovery.error || iam.error || profileQuery.error || members.error || orgs.error,
  };
}
