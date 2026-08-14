import { skipToken } from '@reduxjs/toolkit/query';
import { compact, uniq } from 'lodash';
import { useMemo, useState } from 'react';
import { useDebounce } from 'react-use';

import { t } from '@grafana/i18n';
import { isFetchError } from '@grafana/runtime';
import { type Notebook, useListNotebookQuery } from 'app/api/clients/dashboard/v2beta1';
import { useGetDisplayMappingQuery } from 'app/api/clients/iam/v0alpha1';
import { contextSrv } from 'app/core/services/context_srv';
import { AnnoKeyCreatedBy, AnnoKeyUpdatedTimestamp } from 'app/features/apiserver/types';

import {
  useSearchNotebooksQuery,
  type NotebookSearchQuery,
  type ResultItem,
  type WhereNode,
} from './notebookSearchApi';

/**
 * Field names as the index declares them (resource.SEARCH_FIELD_* on the backend). Only the
 * ones this page projects.
 */
const SearchField = {
  title: 'title',
  tags: 'tags',
  createdBy: 'createdBy',
  created: 'created',
  updated: 'updated',
} as const;

/**
 * The endpoint clamps to this, and it is what LIST asked for before the migration, so the
 * window on screen is the same size either way.
 */
export const NOTEBOOKS_PAGE_LIMIT = 500;

/** Projection: everything the table renders, and nothing else. */
const SEARCH_FIELDS = [
  SearchField.title,
  SearchField.tags,
  SearchField.createdBy,
  SearchField.created,
  SearchField.updated,
];

/**
 * Requests are debounced, so this gates network traffic rather than re-filtering. Matches
 * the dashboard search debounce.
 */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Whether this Grafana serves `.../notebooks/search` at all. The route is mounted from
 * `[grafana-apiserver] enable_search_api`, which is off by default and is not reported in
 * frontend settings, so the only way to find out is to ask and see.
 *
 * Module-level on purpose: RTK Query caches per argument, so component state would let every
 * keystroke produce a fresh argument and re-attempt a route that is already known to be
 * absent. Delete this, and the LIST branch below, once the endpoint is on everywhere.
 */
let searchUnavailable = false;

/** A notebook flattened for display, so the table never has to know about k8s metadata. */
export interface NotebookRow {
  uid: string;
  title: string;
  tags: string[];
  /** Identity key of the creator, e.g. `user:abc123`. Empty when the resource has no createdBy. */
  authorUid: string;
  authorName: string;
  /** Unix millis, as the search index stores them. Zero when unknown. */
  created: number;
  updated: number;
}

interface UseNotebooksListOptions {
  /** Skips every request when the feature is disabled, so a gated page issues no traffic. */
  enabled: boolean;
}

export function useNotebooksList({ enabled }: UseNotebooksListOptions) {
  const [searchQuery, setSearchQuery] = useState('');
  const [createdByMe, setCreatedByMe] = useState(false);
  // Mirrors the module latch into state, so the branches below have it as a real dependency and a
  // flip re-renders on its own. A fresh mount starts from what earlier mounts already learned.
  const [usingFallback, setUsingFallback] = useState(searchUnavailable);

  const [debouncedSearch, setDebouncedSearch] = useState('');
  useDebounce(() => setDebouncedSearch(searchQuery), SEARCH_DEBOUNCE_MS, [searchQuery]);

  const currentUserUid = contextSrv.user.uid ? `user:${contextSrv.user.uid}` : undefined;
  // Without an identity there is nobody to filter by, so the toggle cannot be honoured
  // server-side and asking would filter everything out.
  const filterByAuthor = createdByMe && Boolean(currentUserUid);

  const searchBody = useMemo(
    () => buildSearchQuery(debouncedSearch, filterByAuthor ? currentUserUid : undefined),
    [debouncedSearch, filterByAuthor, currentUserUid]
  );

  const search = useSearchNotebooksQuery(enabled && !usingFallback ? searchBody : skipToken);

  // Latch on the first "no such route" answer, so we stop asking for the rest of the session.
  if (search.error && isRouteMissing(search.error) && !usingFallback) {
    searchUnavailable = true;
    // Setting state during render is the derived-state pattern: React re-runs this component
    // before committing, so the fallback request starts in the same commit and nothing paints in
    // between.
    setUsingFallback(true);
  }

  const list = useListNotebookQuery(enabled && usingFallback ? { limit: NOTEBOOKS_PAGE_LIMIT } : skipToken);

  const active = usingFallback ? list : search;

  const rows = useMemo(() => {
    if (usingFallback) {
      return (list.data?.items ?? []).map(listRow);
    }
    return (search.data?.items ?? []).map(searchRow);
  }, [usingFallback, list.data, search.data]);

  const authorUids = useMemo(() => uniq(compact(rows.map((row) => row.authorUid))), [rows]);

  // The display-mapping endpoint rejects an empty key list with a 400, so skip it when there is
  // nobody to resolve (e.g. an empty library).
  const { data: displayMapping } = useGetDisplayMappingQuery(authorUids.length > 0 ? { key: authorUids } : skipToken);

  const authorNames = useMemo(() => {
    const map = new Map<string, string>();
    // Keyed by identity rather than by position: the server builds `display` from its query
    // results and appends constants, so it is neither in `keys` order nor the same length.
    // Both key forms are indexed because a createdBy annotation may carry either the UID
    // (`user:abc`) or the legacy numeric id (`user:1`), and only the UID form comes back as
    // identity.name.
    for (const entry of displayMapping?.display ?? []) {
      if (entry.identity.name) {
        map.set(`${entry.identity.type}:${entry.identity.name}`, entry.displayName);
      }
      if (entry.internalId) {
        map.set(`${entry.identity.type}:${entry.internalId}`, entry.displayName);
      }
    }
    return map;
  }, [displayMapping]);

  const namedRows = useMemo(
    () => rows.map((row) => ({ ...row, authorName: authorNames.get(row.authorUid) || anonymousAuthor() })),
    [rows, authorNames]
  );

  // On the fallback path the server did no filtering, so it has to happen here. When search
  // is serving, the predicates are already in the request and this is a no-op.
  const filteredRows = useMemo(() => {
    if (!usingFallback) {
      return namedRows;
    }
    const needle = debouncedSearch.trim().toLowerCase();
    return namedRows.filter(
      (row) =>
        (!needle || row.title.toLowerCase().includes(needle)) && (!filterByAuthor || row.authorUid === currentUserUid)
    );
  }, [usingFallback, namedRows, debouncedSearch, filterByAuthor, currentUserUid]);

  const isFiltered = Boolean(debouncedSearch.trim()) || filterByAuthor;

  return {
    rows: filteredRows,
    /**
     * How many the server holds, filters included, or undefined when it does not say — LIST only
     * ever reports the page it returned, so the fallback path has no total to offer. Read a number
     * here with `isTotalExact`: the server falls back to an upper bound when counting exactly
     * would cost too much.
     */
    totalCount: usingFallback ? undefined : (search.data?.metadata.totalHits ?? 0),
    isTotalExact: search.data?.metadata.totalHitsRelation !== 'lte',
    /** How many rows the request brought back, before any client-side filtering. */
    loadedCount: namedRows.length,
    /**
     * More matches exist than the page on screen. Search offers a continue token on a short page
     * too, whenever its total is inexact, so a cursor alone does not mean there is more — a full
     * page does. LIST is the other way around: it stops at its own byte limit before reaching the
     * requested count, so a short page with a token there is real truncation.
     */
    isTruncated: usingFallback
      ? Boolean(list.data?.metadata?.continue)
      : Boolean(search.data?.metadata.continue) && namedRows.length >= NOTEBOOKS_PAGE_LIMIT,
    /** Distinguishes "no notebooks at all" from "none matched the filters". */
    isFiltered,
    searchQuery,
    setSearchQuery,
    createdByMe,
    setCreatedByMe,
    /** Without an identity there is no "me", so the filter has nothing to mean. */
    canFilterByMe: Boolean(currentUserUid),
    isLoading: active.isLoading,
    error: active.error,
  };
}

/**
 * Builds the where tree. Omitted entirely when nothing is filtered — that matches every
 * notebook — and flattened to a single leaf when only one predicate applies, because v1
 * accepts just a top-level leaf or one `and` of leaves.
 */
function buildSearchQuery(search: string, authorUid: string | undefined): NotebookSearchQuery {
  const leaves: WhereNode[] = [];
  const needle = search.trim();
  if (needle) {
    // Fields default to the kind's text fields, which is `title` — the one thing this box
    // searches.
    leaves.push({ text: { value: needle } });
  }
  if (authorUid) {
    // Only the `user:<uid>` form: that is what the apiserver records on create. Author *names* are
    // resolved from either form because old resources elsewhere carry the legacy numeric id, but a
    // notebook cannot have been written that way, so matching on one form is enough here.
    leaves.push({ filter: { field: SearchField.createdBy, operator: 'In', values: [authorUid] } });
  }

  // No sort: `created`/`updated` are retrieve-only and 422 if sorted on, and the table owns
  // ordering anyway. The server ranks by relevance for a text query and by name otherwise.
  return {
    fields: SEARCH_FIELDS,
    limit: NOTEBOOKS_PAGE_LIMIT,
    ...(leaves.length === 1 ? { where: leaves[0] } : {}),
    ...(leaves.length > 1 ? { where: { and: leaves } } : {}),
  };
}

function searchRow(item: ResultItem): NotebookRow {
  const fields = item.fields ?? {};
  const created = numberField(fields[SearchField.created]);
  return {
    // From the envelope, not the projection: `name` carries no retrieve capability, but every
    // hit identifies itself.
    uid: item.resource.name,
    title: stringField(fields[SearchField.title]),
    tags: stringArrayField(fields[SearchField.tags]),
    authorUid: stringField(fields[SearchField.createdBy]),
    authorName: '',
    created,
    // A notebook that has never been written since creation carries no updated timestamp — the
    // apiserver only sets one on update — so the column would otherwise be blank for it.
    updated: numberField(fields[SearchField.updated]) || created,
  };
}

function listRow(notebook: Notebook): NotebookRow {
  const created = notebook.metadata.creationTimestamp;
  const updated = notebook.metadata.annotations?.[AnnoKeyUpdatedTimestamp];
  return {
    uid: notebook.metadata.name ?? '',
    title: notebook.spec.title,
    tags: notebook.spec.tags ?? [],
    authorUid: notebook.metadata.annotations?.[AnnoKeyCreatedBy] ?? '',
    authorName: '',
    // Converted to millis so both paths hand the table one shape.
    created: toMillis(created),
    updated: toMillis(updated) || toMillis(created),
  };
}

function toMillis(timestamp: string | undefined): number {
  if (!timestamp) {
    return 0;
  }
  const parsed = Date.parse(timestamp);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Projected values arrive as JSON, so each is narrowed rather than asserted: a field the
 * index never populated is absent, and one populated oddly should not break the row.
 */
function stringField(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function numberField(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function stringArrayField(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

/**
 * Whether the failure means the endpoint is not served here, as opposed to a real error worth
 * showing. An unmounted route parses as a request for a resource named "search", so it comes
 * back as a 404; 405 covers an apiserver that knows the path but not the verb.
 */
function isRouteMissing(error: unknown): boolean {
  return isFetchError(error) && (error.status === 404 || error.status === 405);
}

/** Keeps internal identity keys like `user:abc123` out of the UI when a lookup comes back empty. */
function anonymousAuthor(): string {
  return t('notebooks.list.unknown-author', 'Anonymous');
}

/** Test seam: the latch is module state, so it has to be resettable between cases. */
export function __resetSearchAvailabilityForTests() {
  searchUnavailable = false;
}
