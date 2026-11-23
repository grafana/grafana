import { type StarsList } from 'app/api/clients/collections/v1alpha1';
import { contextSrv } from 'app/core/services/context_srv';

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
