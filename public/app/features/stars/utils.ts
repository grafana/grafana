import { type StarsList } from 'app/api/clients/collections/v1alpha1';
import { contextSrv } from 'app/core/services/context_srv';
import { type DashboardQueryResult } from 'app/features/search/service/types';

/** Extracts the `names` for a given resource group/kind from a collections stars response. */
export function findStarredNames(stars: StarsList | undefined, group: string, kind: string): string[] {
  return stars?.items?.[0]?.spec.resource.find((r) => r.group === group && r.kind === kind)?.names ?? [];
}

/** Whether the star set holds one of `names` as an object of one of `kinds`. */
export function starsHoldName(
  stars: StarsList | undefined,
  kinds: ReadonlyArray<{ group: string; kind: string }>,
  names: string[]
): boolean {
  const starredNames = new Set(kinds.flatMap(({ group, kind }) => findStarredNames(stars, group, kind)));
  return names.some((name) => starredNames.has(name));
}

/** The starred names of one search kind. */
export interface StarredNames {
  kind: string;
  names: string[];
}

/**
 * A starred object as a list shows it: the fields of a search row that an object of any kind has a value for. A
 * row of the dashboard search is one as it stands.
 */
export type StarredRow = Pick<DashboardQueryResult, 'kind' | 'uid' | 'name' | 'url' | 'description' | 'location'>;

// Created once, not per sort
const collator = new Intl.Collator();

/** The order of starred rows in a list: by title, which a row holds as its `name`. */
export function byTitle(a: StarredRow, b: StarredRow): number {
  return collator.compare(a.name, b.name);
}

/**
 * Whether the current user has a stars resource to read and write. Anonymous users and identities without a uid
 * have none, so the API rejects their `user-` name.
 */
export function canUseStars(): boolean {
  return contextSrv.isSignedIn && Boolean(contextSrv.user.uid);
}

/** Field selector for the current user's stars resource (one Stars object per user, named `user-<uid>`). */
export function userStarsFieldSelector(): string {
  return `metadata.name=user-${contextSrv.user.uid}`;
}
