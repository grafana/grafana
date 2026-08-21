import { skipToken } from '@reduxjs/toolkit/query';
import { compact, uniq } from 'lodash';
import { useMemo, useState } from 'react';
import { useDebounce } from 'react-use';

import { t } from '@grafana/i18n';
import { type ComboboxOption } from '@grafana/ui';
import { type Notebook, useListNotebookQuery } from 'app/api/clients/dashboard/v2beta1';
import { useGetDisplayMappingQuery } from 'app/api/clients/iam/v0alpha1';
import { contextSrv } from 'app/core/services/context_srv';
import { AnnoKeyCreatedBy, AnnoKeyUpdatedTimestamp } from 'app/features/apiserver/types';

const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

/**
 * Its own rather than the list page's: that number now lives in a module which injects RTK endpoints
 * as it loads, and importing it would pull the list's search API into the graph of every dashboard
 * and Explore panel menu that can open this modal.
 *
 * Without an explicit limit the apiserver still stops at its own page size and hands back a continue
 * token, which would drop the rest of the library silently. A bounded page makes the truncation
 * visible, so the picker can say the list is partial.
 */
const PICKER_PAGE_LIMIT = 500;

/** Debounced only to avoid re-filtering on every keystroke - the filtering itself is local. */
const SEARCH_DEBOUNCE_MS = 200;

/** A notebook flattened for the picker, so the cards never have to know about k8s metadata. */
export interface NotebookPickerRow {
  uid: string;
  title: string;
  tags: string[];
  /** Identity key of the creator, e.g. `user:abc123`. Empty when the resource has no createdBy. */
  authorUid: string;
  authorName: string;
  /** ISO timestamps. These sort correctly as plain strings. */
  created: string;
  updated: string;
  /** Cells in the layout, so a card can say how much is in a notebook without opening it. */
  blockCount: number;
}

/**
 * The picker's own read of the notebook library.
 *
 * It used to share useNotebooksList, until that hook moved to server-side search: it now offers a
 * single "created by me" toggle, reports no author names, and drops the cell count, because that is
 * what its table needs. The picker needs the tag and author filters it is designed around, so it
 * reads the library itself and filters locally rather than bending the list page's hook back into a
 * shape it has moved away from.
 *
 * The duplication is deliberate and worth naming: two client-side readers of the same resource. The
 * way out is for these filters to become query predicates on the search API, at which point this can
 * go - not for the picker to quietly lose two of its filters.
 */
export function useNotebookPickerData() {
  const [searchQuery, setSearchQuery] = useState('');
  const [authorFilter, setAuthorFilter] = useState('');
  const [tagFilter, setTagFilter] = useState<string[]>([]);

  const [debouncedSearch, setDebouncedSearch] = useState('');
  useDebounce(() => setDebouncedSearch(searchQuery), SEARCH_DEBOUNCE_MS, [searchQuery]);

  const { data, isLoading, error } = useListNotebookQuery({ limit: PICKER_PAGE_LIMIT });

  const notebooks = useMemo(() => data?.items ?? [], [data]);

  const authorUids = useMemo(() => uniq(compact(notebooks.map(getAuthorUid))), [notebooks]);

  // The display-mapping endpoint rejects an empty key list with a 400, so skip it when there is
  // nobody to resolve (e.g. an empty library).
  const { data: displayMapping } = useGetDisplayMappingQuery(authorUids.length > 0 ? { key: authorUids } : skipToken);

  const authorNames = useMemo(() => {
    const map = new Map<string, string>();
    // Keyed by identity rather than by position: the server builds `display` from its query results
    // and appends constants, so it is neither in `keys` order nor the same length. Both key forms are
    // indexed because a createdBy annotation may carry either the UID (`user:abc`) or the legacy
    // numeric id (`user:1`), and only the UID form comes back as identity.name.
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

  const rows = useMemo(
    () =>
      notebooks.map((notebook): NotebookPickerRow => {
        const authorUid = getAuthorUid(notebook);
        const created = notebook.metadata.creationTimestamp ?? '';
        return {
          uid: notebook.metadata.name ?? '',
          title: notebook.spec.title,
          tags: notebook.spec.tags ?? [],
          authorUid,
          authorName: authorNames.get(authorUid) || anonymousAuthor(),
          created,
          updated: notebook.metadata.annotations?.[AnnoKeyUpdatedTimestamp] ?? created,
          blockCount: notebook.spec.layout.spec.cells.length,
        };
      }),
    [notebooks, authorNames]
  );

  // Derived from the loaded rows rather than from a tag endpoint: filtering is client-side over the
  // same page, so offering a tag no row on this page carries would just yield an empty list.
  const tagOptions = useMemo<Array<ComboboxOption<string>>>(() => {
    const tags = uniq(rows.flatMap((row) => row.tags));
    tags.sort(collator.compare);
    return tags.map((tag) => ({ value: tag, label: tag }));
  }, [rows]);

  const authorOptions = useMemo<Array<ComboboxOption<string>>>(() => {
    const options = authorUids.map((uid) => ({ value: uid, label: authorNames.get(uid) || anonymousAuthor() }));
    // Surface the current user first - they are the most likely filter target.
    const currentUserUid = contextSrv.user.uid ? `user:${contextSrv.user.uid}` : undefined;
    options.sort((a, b) => {
      if (a.value === currentUserUid) {
        return -1;
      }
      if (b.value === currentUserUid) {
        return 1;
      }
      return collator.compare(a.label, b.label);
    });
    return options;
  }, [authorUids, authorNames]);

  const filteredRows = useMemo(() => {
    const needle = debouncedSearch.trim().toLowerCase();
    return rows.filter(
      (row) =>
        (!needle || row.title.toLowerCase().includes(needle)) &&
        (!authorFilter || row.authorUid === authorFilter) &&
        // Every selected tag must match, as elsewhere in Grafana: picking two tags narrows the list
        // rather than widening it.
        tagFilter.every((tag) => row.tags.includes(tag))
    );
  }, [rows, debouncedSearch, authorFilter, tagFilter]);

  return {
    rows: filteredRows,
    /** Total before filtering - used to tell "nothing exists" apart from "nothing matched". */
    totalCount: rows.length,
    /** The server had more than one page, so the list on screen is not the whole library. */
    isTruncated: Boolean(data?.metadata?.continue),
    authorOptions,
    tagOptions,
    searchQuery,
    setSearchQuery,
    authorFilter,
    setAuthorFilter,
    tagFilter,
    setTagFilter,
    isLoading,
    error,
  };
}

/** Keeps internal identity keys like `user:abc123` out of the UI when a lookup comes back empty. */
function anonymousAuthor(): string {
  return t('notebooks.add-panel.unknown-author', 'Anonymous');
}

function getAuthorUid(notebook: Notebook): string {
  return notebook.metadata.annotations?.[AnnoKeyCreatedBy] ?? '';
}
