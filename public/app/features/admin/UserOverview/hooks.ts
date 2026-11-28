import { skipToken } from '@reduxjs/toolkit/query';
import { useCallback, useMemo, useState } from 'react';

import { useFlagKubernetesTeamsApi } from '@grafana/runtime/internal';
import { iamAPIv0alpha1 } from 'app/api/clients/iam/v0alpha1';
import { useGetOrgUsersForCurrentOrgQuery, useGetUserByIdQuery, useGetUserTeamsQuery } from 'app/api/clients/legacy';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';
import { type OrgUser, type UserDTO } from 'app/types/user';

/** The fields the page shows for any user, whichever of the two sources the viewer may read. */
export interface OverviewUser {
  id: number;
  uid: string;
  login: string;
  name: string;
  email: string;
  avatarUrl?: string;
  isDisabled: boolean;
  isProvisioned: boolean;
  isExternal: boolean;
  authLabels: string[];
  createdAt?: string;
  lastSeenAt?: string;
}

function toOverviewUser(profile?: UserDTO, member?: OrgUser): OverviewUser | undefined {
  const source = profile ?? member;
  if (!source) {
    return undefined;
  }
  const { uid, login, name, email, avatarUrl, isDisabled } = source;
  return {
    id: 'userId' in source ? source.userId : source.id,
    uid,
    login,
    name,
    email,
    avatarUrl,
    isDisabled,
    isProvisioned: !!source.isProvisioned,
    // Only the account says whether the login is external; a membership lists its auth providers.
    isExternal: profile ? !!profile.isExternal : !!source.authLabels?.length,
    authLabels: source.authLabels ?? [],
    createdAt: profile?.createdAt ?? member?.created,
    lastSeenAt: member?.lastSeenAt,
  };
}

/**
 * Loads a user from two independent sources: the global account (`users:read`) and the
 * membership in the current organization (`org.users:read`). Either one is enough to show the page.
 *
 * @param uid The route parameter: the user's UID, or the numerical ID that older links carry.
 */
export function useUserOverview(uid: string) {
  // The backend reads an all-digit parameter as the numerical ID, so the membership lookup does the same.
  const id = /^\d+$/.test(uid) ? Number(uid) : 0;
  const account = useGetUserByIdQuery(
    contextSrv.hasPermission(AccessControlAction.UsersRead) ? { userId: uid } : skipToken
  );
  const members = useGetOrgUsersForCurrentOrgQuery(
    contextSrv.hasPermission(AccessControlAction.OrgUsersRead)
      ? { ...(id ? { userId: id } : { userUid: uid }), limit: 1 }
      : skipToken
  );
  const profile = account.currentData;
  const rows = members.currentData;
  const member = rows?.find((row) => (id ? row.userId === id : row.uid === uid));
  const user = useMemo(() => toOverviewUser(profile, member), [profile, member]);

  return {
    user,
    profile,
    member,
    account,
    members,
    isNotMember: rows?.length === 0,
    // A server without the user filter returns other users, which says nothing about this one.
    isMembershipUnknown: !!rows?.length && !member,
  };
}

export interface UserTeam {
  uid: string;
  /** Legacy numeric id: the team roles API is keyed by it. */
  id?: number;
  name: string;
  email: string;
}

interface TeamSearchHit {
  name: string;
  title: string;
  email?: string;
  internalId?: number;
}

// The largest page the team search accepts.
const TEAM_SEARCH_PAGE_SIZE = 1000;

const teamsAPI = iamAPIv0alpha1.injectEndpoints({
  endpoints: (build) => ({
    // The search returns one page at a time, and a team left out would hide the roles it grants.
    getMemberTeams: build.query<TeamSearchHit[], string>({
      queryFn: async (member, { dispatch }) => {
        const teams: TeamSearchHit[] = [];
        try {
          for (let page = 1; ; page++) {
            // The generated client leaves the search response untyped.
            const { hits = [], totalHits = 0 }: { hits?: TeamSearchHit[]; totalHits?: number } = await dispatch(
              iamAPIv0alpha1.endpoints.getSearchTeams.initiate(
                { member, limit: TEAM_SEARCH_PAGE_SIZE, page, sort: 'title' },
                // The pages are parts of this query, not cache entries of their own.
                { subscribe: false, forceRefetch: true }
              )
            ).unwrap();
            teams.push(...hits);
            if (!hits.length || teams.length >= totalHits) {
              return { data: teams };
            }
          }
        } catch (error) {
          return { error };
        }
      },
      providesTags: ['Search'],
    }),
  }),
});

/**
 * The teams a user belongs to in the current organization.
 *
 * @param uid The user's UID. The team search does not accept the numerical ID.
 */
export function useUserTeams(uid: string | undefined, { skip = false } = {}) {
  const useTeamsApi = useFlagKubernetesTeamsApi();
  const search = teamsAPI.useGetMemberTeamsQuery(uid && useTeamsApi && !skip ? uid : skipToken);
  const legacy = useGetUserTeamsQuery(uid && !useTeamsApi && !skip ? { userId: uid } : skipToken);

  const teams = useMemo<UserTeam[] | undefined>(() => {
    if (useTeamsApi) {
      return search.currentData?.map((hit) => ({
        uid: hit.name,
        id: hit.internalId,
        name: hit.title,
        email: hit.email ?? '',
      }));
    }
    return legacy.currentData?.map((team) => ({
      uid: team.uid,
      id: team.id,
      name: team.name,
      email: team.email ?? '',
    }));
  }, [useTeamsApi, search.currentData, legacy.currentData]);

  const { isLoading, error } = useTeamsApi ? search : legacy;
  return { teams, isLoading, error };
}

/** Clears the previous failure and resolves to whether the action succeeded. Never rejects. */
export type RunAction = (action: Promise<unknown>) => Promise<boolean>;

/** Keeps the failure of the latest user action for display. */
export function useAction(): { run: RunAction; error: unknown } {
  const [error, setError] = useState<unknown>();
  const run = useCallback<RunAction>((action) => {
    setError(undefined);
    return action.then(
      () => true,
      (failure: unknown) => {
        setError(failure);
        return false;
      }
    );
  }, []);

  return { run, error };
}
