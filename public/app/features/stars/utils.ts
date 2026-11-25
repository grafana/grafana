import { type StarsList } from 'app/api/clients/collections/v1alpha1';
import { contextSrv } from 'app/core/services/context_srv';
import { type SearchRow } from 'app/features/search/service/types';

/** Extracts the `names` for a given resource group/kind from a collections stars response. */
export function findStarredNames(stars: StarsList | undefined, group: string, kind: string): string[] {
  return stars?.items?.[0]?.spec.resource.find((r) => r.group === group && r.kind === kind)?.names ?? [];
}

/** The starred names of one search kind. */
export interface StarredNames {
  kind: string;
  names: string[];
}

// Created once, not per sort
const collator = new Intl.Collator();

/** The order of starred rows in a list: by title, which a row holds as its `name`. */
export function byTitle(a: SearchRow, b: SearchRow): number {
  return collator.compare(a.name, b.name);
}

/**
 * Whether the current user has a stars resource to read and write. Anonymous users and identities without a uid
 * have none, so the API rejects their `user-` name.
 */
export function canUseStars(): boolean {
  return contextSrv.isSignedIn && Boolean(contextSrv.user.uid);
}

/** Name of the current user's stars resource: one Stars object per user. */
export function userStarsName(): string {
  return `user-${contextSrv.user.uid}`;
}

/** Field selector for the current user's stars resource. */
export function userStarsFieldSelector(): string {
  return `metadata.name=${userStarsName()}`;
}
