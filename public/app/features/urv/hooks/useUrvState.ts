import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom-v5-compat';

import { locationUtil } from '@grafana/data';

export const URV_SORTS = ['updated', 'created', 'title', 'relevance'] as const;
export type UrvSort = (typeof URV_SORTS)[number];

export const URV_GROUPS = ['type', 'none'] as const;
export type UrvGroup = (typeof URV_GROUPS)[number];

export const URV_PLACES = ['all', 'recent', 'starred', 'shared', 'trash'] as const;
export type UrvPlace = (typeof URV_PLACES)[number];

export const URV_UPDATED = ['24h', '7d', '30d'] as const;
export type UrvUpdated = (typeof URV_UPDATED)[number];

const UPDATED_MS: Record<UrvUpdated, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

export function updatedSince(updated: UrvUpdated | undefined): number | undefined {
  return updated ? Date.now() - UPDATED_MS[updated] : undefined;
}

/** Folder value for "No folder". Real folder uids can't contain "~". */
export const NO_FOLDER = '~none';
/** Folder value for "Root level": top-level folders and everything else at the root. */
export const ROOT_LEVEL = '~root';
/** Folder value for "Browse all folders": the whole folder tree instead of results. */
export const ALL_FOLDERS = '~folders';

/** The folder uid, or undefined for the places that aren't a real folder. */
export function folderUID(folder: string | undefined): string | undefined {
  return folder && folder !== NO_FOLDER && folder !== ROOT_LEVEL && folder !== ALL_FOLDERS ? folder : undefined;
}

export interface UrvState {
  query: string;
  /** One `group/resource`, or unset for the All tab. */
  type?: string;
  /** A folder uid, NO_FOLDER, ROOT_LEVEL, ALL_FOLDERS, or unset for everything. */
  folder?: string;
  place: UrvPlace;
  tags: string[];
  owners: string[];
  updated?: UrvUpdated;
  /** Only things synced from a Git repository. */
  provisioned: boolean;
  group: UrvGroup;
  sort: UrvSort;
}

function oneOf<T extends string>(values: readonly T[], value: string | null, fallback: T): T;
function oneOf<T extends string>(values: readonly T[], value: string | null): T | undefined;
function oneOf<T extends string>(values: readonly T[], value: string | null, fallback?: T): T | undefined {
  return values.find((v) => v === value) ?? fallback;
}

function readState(params: URLSearchParams): UrvState {
  return {
    query: params.get('q') ?? '',
    type: params.get('type') || undefined,
    folder: params.get('folder') || undefined,
    place: oneOf(URV_PLACES, params.get('place'), 'all'),
    tags: params.getAll('tag'),
    owners: params.getAll('owner'),
    updated: oneOf(URV_UPDATED, params.get('updated')),
    provisioned: params.get('provisioned') === 'true',
    group: oneOf(URV_GROUPS, params.get('group'), 'type'),
    sort: oneOf(URV_SORTS, params.get('sort'), 'updated'),
  };
}

function writeState(prev: URLSearchParams, patch: Partial<UrvState>): URLSearchParams {
  const next = new URLSearchParams(prev);
  const setOne = (key: string, value: string | undefined) => (value ? next.set(key, value) : next.delete(key));
  const setMany = (key: string, values: string[]) => {
    next.delete(key);
    values.forEach((value) => next.append(key, value));
  };
  if (patch.query !== undefined) {
    setOne('q', patch.query);
  }
  if ('type' in patch) {
    setOne('type', patch.type);
  }
  if ('folder' in patch) {
    setOne('folder', patch.folder);
  }
  if (patch.place !== undefined) {
    setOne('place', patch.place === 'all' ? undefined : patch.place);
  }
  if (patch.tags !== undefined) {
    setMany('tag', patch.tags);
  }
  if (patch.owners !== undefined) {
    setMany('owner', patch.owners);
  }
  if ('updated' in patch) {
    setOne('updated', patch.updated);
  }
  if (patch.provisioned !== undefined) {
    setOne('provisioned', patch.provisioned ? 'true' : undefined);
  }
  if (patch.group !== undefined) {
    setOne('group', patch.group === 'type' ? undefined : patch.group);
  }
  if (patch.sort !== undefined) {
    setOne('sort', patch.sort === 'updated' ? undefined : patch.sort);
  }
  return next;
}

/** Link to the same view in another folder, keeping the type, query and filters. */
export function folderHref(params: URLSearchParams, folder: string | undefined): string {
  const search = writeState(params, { folder }).toString();
  return locationUtil.assureBaseUrl(search ? `/urv?${search}` : '/urv');
}

export function useUrvState() {
  const [params, setParams] = useSearchParams();
  const state = useMemo(() => readState(params), [params]);

  // Functional update so two changes in the same tick don't overwrite each other.
  const update = useCallback(
    (patch: Partial<UrvState>) => setParams((prev) => writeState(prev, patch), { replace: true }),
    [setParams]
  );

  return { state, update };
}

export function toggleValue(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}
