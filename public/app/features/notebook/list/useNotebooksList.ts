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
 * Without an explicit limit the apiserver still stops at its own page size (2 MiB) and hands back a
 * continue token, which would drop the rest of the list silently. Asking for a bounded page makes
 * the truncation visible so the UI can say so.
 */
export const NOTEBOOKS_PAGE_LIMIT = 500;

/** A notebook flattened for display, so the table never has to know about k8s metadata. */
export interface NotebookRow {
  uid: string;
  title: string;
  tags: string[];
  /** Identity key of the creator, e.g. `user:abc123`. Empty when the resource has no createdBy. */
  authorUid: string;
  authorName: string;
  /** ISO timestamps. These sort correctly as plain strings. */
  created: string;
  updated: string;
}

interface UseNotebooksListOptions {
  /** Skips every request when the feature is disabled, so a gated page issues no traffic. */
  enabled: boolean;
}

export function useNotebooksList({ enabled }: UseNotebooksListOptions) {
  const [searchQuery, setSearchQuery] = useState('');
  const [authorFilter, setAuthorFilter] = useState('');

  // Filtering is client-side, so debounce only to avoid re-filtering the list on every keystroke.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useDebounce(() => setDebouncedSearch(searchQuery), 200, [searchQuery]);

  const { data, isLoading, error } = useListNotebookQuery(enabled ? { limit: NOTEBOOKS_PAGE_LIMIT } : skipToken);

  const notebooks = useMemo(() => data?.items ?? [], [data]);

  const authorUids = useMemo(() => uniq(compact(notebooks.map(getAuthorUid))), [notebooks]);

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

  const rows = useMemo(
    () =>
      notebooks.map((notebook): NotebookRow => {
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
        };
      }),
    [notebooks, authorNames]
  );

  const authorOptions = useMemo<Array<ComboboxOption<string>>>(() => {
    const options = authorUids.map((uid) => ({ value: uid, label: authorNames.get(uid) || anonymousAuthor() }));
    // Surface the current user first — they are the most likely filter target.
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

  // Ordering belongs to the table, which owns the sort state and renders the sort indicator.
  const filteredRows = useMemo(() => {
    const needle = debouncedSearch.trim().toLowerCase();
    return rows.filter(
      (row) =>
        (!needle || row.title.toLowerCase().includes(needle)) && (!authorFilter || row.authorUid === authorFilter)
    );
  }, [rows, debouncedSearch, authorFilter]);

  return {
    rows: filteredRows,
    /** Total before filtering — used to tell "nothing exists" apart from "nothing matched". */
    totalCount: rows.length,
    /** The server had more than one page, so the list on screen is not the whole library. */
    isTruncated: Boolean(data?.metadata?.continue),
    authorOptions,
    searchQuery,
    setSearchQuery,
    authorFilter,
    setAuthorFilter,
    isLoading,
    error,
  };
}

/** Keeps internal identity keys like `user:abc123` out of the UI when a lookup comes back empty. */
function anonymousAuthor(): string {
  return t('notebooks.list.unknown-author', 'Anonymous');
}

function getAuthorUid(notebook: Notebook): string {
  return notebook.metadata.annotations?.[AnnoKeyCreatedBy] ?? '';
}
