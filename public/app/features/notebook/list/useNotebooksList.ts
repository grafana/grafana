import { skipToken } from '@reduxjs/toolkit/query';
import { compact, uniq } from 'lodash';
import { useMemo, useState } from 'react';
import { useDebounce } from 'react-use';

import { type ComboboxOption } from '@grafana/ui';
import { type Notebook, useListNotebookQuery } from 'app/api/clients/dashboard/v2beta1';
import { useGetDisplayMappingQuery } from 'app/api/clients/iam/v0alpha1';
import { contextSrv } from 'app/core/services/context_srv';
import { AnnoKeyCreatedBy, AnnoKeyUpdatedTimestamp } from 'app/features/apiserver/types';

const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

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

  const { data, isLoading, error } = useListNotebookQuery(enabled ? {} : skipToken);

  const notebooks = useMemo(() => data?.items ?? [], [data]);

  const authorUids = useMemo(() => uniq(compact(notebooks.map(getAuthorUid))), [notebooks]);

  // The display-mapping endpoint rejects an empty key list with a 400, so skip it when there is
  // nobody to resolve (e.g. an empty library).
  const { data: displayMapping } = useGetDisplayMappingQuery(authorUids.length > 0 ? { key: authorUids } : skipToken);

  const authorNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of displayMapping?.display ?? []) {
      map.set(`${entry.identity.type}:${entry.identity.name}`, entry.displayName);
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
          // Fall back to the raw identity key so a row stays identifiable if the lookup fails.
          authorName: authorNames.get(authorUid) || authorUid,
          created,
          updated: notebook.metadata.annotations?.[AnnoKeyUpdatedTimestamp] ?? created,
        };
      }),
    [notebooks, authorNames]
  );

  const authorOptions = useMemo<Array<ComboboxOption<string>>>(() => {
    const options = authorUids.map((uid) => ({ value: uid, label: authorNames.get(uid) || uid }));
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

  const filteredRows = useMemo(() => {
    const needle = debouncedSearch.trim().toLowerCase();
    const result = rows.filter(
      (row) =>
        (!needle || row.title.toLowerCase().includes(needle)) && (!authorFilter || row.authorUid === authorFilter)
    );
    // Most recently touched first, matching what people expect from an investigation list.
    return result.sort((a, b) => collator.compare(b.updated, a.updated));
  }, [rows, debouncedSearch, authorFilter]);

  return {
    rows: filteredRows,
    /** Total before filtering — used to tell "nothing exists" apart from "nothing matched". */
    totalCount: rows.length,
    authorOptions,
    searchQuery,
    setSearchQuery,
    authorFilter,
    setAuthorFilter,
    isLoading,
    error,
  };
}

function getAuthorUid(notebook: Notebook): string {
  return notebook.metadata.annotations?.[AnnoKeyCreatedBy] ?? '';
}
