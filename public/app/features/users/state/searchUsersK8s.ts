import { OrgRole } from '@grafana/data';
import { iamAPIv0alpha1, type GetSearchUsersUserHit } from 'app/api/clients/iam/v0alpha1';
import { contextSrv } from 'app/core/services/context_srv';
import { type ThunkDispatch } from 'app/types/store';
import { type OrgUser } from 'app/types/user';

export type SearchUserHit = GetSearchUsersUserHit;

export interface OrgUsersFetchResult {
  orgUsers: OrgUser[];
  totalCount: number;
  perPage: number;
  page: number;
}

// Legacy sort is `<column>-<asc|desc>`; k8s uses `<field>` / `-<field>`.
const SORT_FIELD_MAPPING: Record<string, string> = {
  name: 'title',
  lastSeenAtAge: 'lastSeenAt',
};

export function toK8sSort(sort?: string): string | undefined {
  if (!sort) {
    return undefined;
  }
  const match = sort.match(/^(.+)-(asc|desc)$/);
  if (!match) {
    return undefined;
  }
  const field = SORT_FIELD_MAPPING[match[1]] ?? match[1];
  return match[2] === 'desc' ? `-${field}` : field;
}

function toOrgRole(role: string): OrgRole {
  return Object.values(OrgRole).find((r) => r === role) ?? OrgRole.None;
}

export function hitToOrgUser(hit: SearchUserHit): OrgUser {
  return {
    userId: hit.internalId,
    uid: hit.name,
    name: hit.title,
    login: hit.login,
    email: hit.email,
    role: toOrgRole(hit.role),
    orgId: contextSrv.user.orgId,
    avatarUrl: hit.avatarUrl ?? '',
    // k8s: lastSeenAt is epoch seconds, created is epoch milliseconds. Legacy returns ISO strings.
    lastSeenAt: new Date(hit.lastSeenAt * 1000).toISOString(),
    created: hit.created ? new Date(hit.created).toISOString() : undefined,
    lastSeenAtAge: hit.lastSeenAtAge,
    isDisabled: hit.disabled,
    isProvisioned: hit.provisioned,
    authLabels: hit.authLabels,
    accessControl: hit.accessControl,
  };
}

export async function fetchOrgUsersK8s(
  dispatch: ThunkDispatch,
  args: { page: number; perPage: number; query?: string; sort?: string }
): Promise<OrgUsersFetchResult> {
  const page = Math.max(args.page, 1);
  const result = await dispatch(
    iamAPIv0alpha1.endpoints.getSearchUsers.initiate(
      { query: args.query, limit: args.perPage, page, accesscontrol: true, sort: toK8sSort(args.sort) },
      { subscribe: false, forceRefetch: true }
    )
  );
  if (result.error || !result.data) {
    throw result.error ?? new Error('searchUsers returned no data');
  }
  return {
    orgUsers: result.data.hits.map(hitToOrgUser),
    totalCount: result.data.totalHits,
    perPage: args.perPage,
    page,
  };
}
