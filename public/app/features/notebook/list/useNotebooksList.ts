import { skipToken } from '@reduxjs/toolkit/query';
import { compact, uniq } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDebounce } from 'react-use';

import { t } from '@grafana/i18n';
import { useGetDisplayMappingQuery } from 'app/api/clients/iam/v0alpha1';
import { contextSrv } from 'app/core/services/context_srv';

import {
  useSearchNotebooksInfiniteQuery,
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
 * Rows per request, not the size of the list: pages are followed until the server runs out or the
 * accumulation ceiling is reached, so this only decides how many round trips that takes.
 *
 * The endpoint's own maximum, because the pages come back sequentially — each one needs the previous
 * cursor — so a smaller page multiplies latency rather than spreading it. The projection makes the
 * size side cheap either way, at roughly 280 bytes a row. Asking for more is pointless: the server
 * clamps to this.
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
  const [tagFilter, setTagFilter] = useState<string[]>([]);

  const [debouncedSearch, setDebouncedSearch] = useState('');
  useDebounce(() => setDebouncedSearch(searchQuery), SEARCH_DEBOUNCE_MS, [searchQuery]);

  const currentUserUid = contextSrv.user.uid ? `user:${contextSrv.user.uid}` : undefined;
  // Without an identity there is nobody to filter by, so the toggle cannot be honoured
  // server-side and asking would filter everything out.
  const filterByAuthor = createdByMe && Boolean(currentUserUid);

  /**
   * Adds one tag to the filter, for callers that offer a tag rather than the whole selection — the
   * table's rows, where a tag is clickable. A functional update with no dependencies, so this keeps
   * one identity for the life of the hook: the table memoizes its columns, and a new callback each
   * render would rebuild them.
   *
   * Already-selected tags are ignored rather than repeated, as they are in dashboard search.
   */
  const addTagFilter = useCallback((tag: string) => {
    setTagFilter((current) => (current.includes(tag) ? current : [...current, tag]));
  }, []);

  const searchBody = useMemo(
    () => buildSearchQuery(debouncedSearch, filterByAuthor ? currentUserUid : undefined, tagFilter),
    [debouncedSearch, filterByAuthor, currentUserUid, tagFilter]
  );

  const search = useSearchNotebooksInfiniteQuery(enabled ? searchBody : skipToken);

  const { hasNextPage, isFetching, isError, fetchNextPage } = search;
  // Walk the cursor to the end. The table sorts what it holds, so a partial set would order the
  // window rather than the library — "most recent first" has to mean the whole match set.
  //
  // Guarded on isError as much as on isFetching: a page that fails leaves hasNextPage true, and
  // retrying it on every render would be an unbroken loop of failing requests.
  useEffect(() => {
    if (hasNextPage && !isFetching && !isError) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetching, isError, fetchNextPage]);

  /**
   * `currentData` rather than `data`, throughout: RTK Query holds the last successful result while
   * a new argument loads, so reading `data` would show the previous query's rows and counts
   * underneath the new filter. `currentData` is empty until the answer for these filters arrives,
   * which `isReloading` below is there to cover.
   */
  const rows = useMemo(
    () => (search.currentData?.pages ?? []).flatMap((page) => page.items.map(searchRow)),
    [search.currentData]
  );

  /**
   * Whether anything has ever been shown, so the first load and a filter change can be told apart.
   * A ref because it only gates rendering of state we already have — flipping it must not itself
   * schedule a render.
   */
  const hasLoadedOnce = useRef(false);
  if (search.currentData !== undefined) {
    hasLoadedOnce.current = true;
  }

  const authorUids = useMemo(() => uniq(compact(rows.map((row) => row.authorUid))), [rows]);

  /**
   * Names resolved so far, accumulated rather than derived from the latest response. Filtering
   * changes which authors are on screen, and re-deriving would blank the whole column back to
   * Anonymous until the next answer arrived — a second render pass over every row, for names
   * already known.
   */
  const [authorNames, setAuthorNames] = useState<ReadonlyMap<string, string>>(new Map());

  // Only the ones still unknown: the endpoint rejects an empty key list with a 400, and asking
  // again for a name already held would buy nothing.
  const displayArg = useMemo(() => {
    const missing = authorUids.filter((uid) => !authorNames.has(uid));
    return missing.length > 0 ? { key: missing } : skipToken;
  }, [authorUids, authorNames]);

  const { data: displayMapping } = useGetDisplayMappingQuery(displayArg);

  useEffect(() => {
    const entries = displayMapping?.display;
    if (!entries?.length) {
      return;
    }
    setAuthorNames((previous) => {
      const next = new Map(previous);
      // Keyed by identity rather than by position: the server builds `display` from its query
      // results and appends constants, so it is neither in `keys` order nor the same length.
      // Both key forms are indexed because a createdBy annotation may carry either the UID
      // (`user:abc`) or the legacy numeric id (`user:1`), and only the UID form comes back as
      // identity.name.
      for (const entry of entries) {
        if (entry.identity.name) {
          next.set(`${entry.identity.type}:${entry.identity.name}`, entry.displayName);
        }
        if (entry.internalId) {
          next.set(`${entry.identity.type}:${entry.internalId}`, entry.displayName);
        }
      }
      // A response that told us nothing new must not produce a new Map, or the rows below would be
      // rebuilt for nothing.
      return next.size === previous.size ? previous : next;
    });
  }, [displayMapping]);

  const namedRows = useMemo(
    () => rows.map((row) => ({ ...row, authorName: authorNames.get(row.authorUid) || anonymousAuthor() })),
    [rows, authorNames]
  );

  const isFiltered = Boolean(debouncedSearch.trim()) || filterByAuthor || tagFilter.length > 0;

  // Every page carries the same total for the query, so the first one answers for all of them.
  const searchMetadata = search.currentData?.pages[0]?.metadata;
  const lastPageMetadata = search.currentData?.pages[search.currentData.pages.length - 1]?.metadata;

  return {
    rows: namedRows,
    /**
     * How many the server holds, filters included. Read it with `isTotalExact`: the server falls
     * back to an upper bound when counting exactly would cost too much.
     */
    totalCount: searchMetadata?.totalHits ?? 0,
    isTotalExact: searchMetadata?.totalHitsRelation !== 'lte',
    /**
     * Matches exist that were never fetched, which only happens at the accumulation ceiling: the
     * cursor is followed to the end otherwise, so a token still on offer with nothing left to fetch
     * means we stopped early.
     */
    isTruncated: Boolean(lastPageMetadata?.continue) && !hasNextPage,
    /**
     * More pages are still on the way, so the rows and counts are still filling in. Not after a
     * failure: the walk stops there but leaves a next page on offer, and saying the list is still
     * loading alongside the error that stopped it would never resolve.
     */
    isLoadingMore: !isError && (hasNextPage || search.isFetchingNextPage),
    /** Distinguishes "no notebooks at all" from "none matched the filters". */
    isFiltered,
    searchQuery,
    setSearchQuery,
    /**
     * The search the requests above actually carry, after the debounce. `searchQuery` holds what the
     * box says right now, so a caller that has to act on a search somebody finished typing reads
     * this one instead.
     */
    debouncedSearch,
    createdByMe,
    setCreatedByMe,
    tagFilter,
    setTagFilter,
    addTagFilter,
    /** Without an identity there is no "me", so the filter has nothing to mean. */
    canFilterByMe: Boolean(currentUserUid),
    /**
     * The first load, when there is nothing to show yet and the whole page can be a spinner. Never
     * true again once something has been shown: swapping the body out later would unmount the
     * filter input and take the caret with it, mid-typing.
     */
    isLoading: search.isLoading && !hasLoadedOnce.current,
    /**
     * A new set of filters is being fetched and nothing is held for them yet. The rows and counts
     * above are empty rather than stale, so this is what tells the page to show a loading
     * affordance in place of "no results" while keeping the filters where they are.
     */
    isReloading: hasLoadedOnce.current && search.isFetching && search.currentData === undefined,
    /**
     * Identifies the filters the rows belong to, for callers that must reset per-filter view state
     * (the table's page index) without resetting it as rows merely accumulate. Built from the
     * committed filters, not the raw input, so it does not change on every keystroke.
     */
    filterKey: `${debouncedSearch.trim()}|${filterByAuthor}|${tagFilter.join(',')}`,
    error: search.error,
  };
}

/**
 * Builds the where tree. Omitted entirely when nothing is filtered — that matches every
 * notebook — and flattened to a single leaf when only one predicate applies, because v1
 * accepts just a top-level leaf or one `and` of leaves.
 */
function buildSearchQuery(search: string, authorUid: string | undefined, tags: string[]): NotebookSearchQuery {
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
  // One leaf per tag rather than one leaf listing them all: `In` is set membership, so a single leaf
  // would match a notebook carrying *any* of them. Selecting two tags narrows the list here as it
  // does elsewhere in Grafana, and `and` of leaves is what expresses that.
  for (const tag of tags) {
    leaves.push({ filter: { field: SearchField.tags, operator: 'In', values: [tag] } });
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

function stringField(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function numberField(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function stringArrayField(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

/** Keeps internal identity keys like `user:abc123` out of the UI when a lookup comes back empty. */
function anonymousAuthor(): string {
  return t('notebooks.list.unknown-author', 'Anonymous');
}
