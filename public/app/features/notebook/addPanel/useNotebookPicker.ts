import { useMemo, useState } from 'react';

import { t } from '@grafana/i18n';
import { type ComboboxOption } from '@grafana/ui';

import { type NotebookRow, useNotebooksList } from '../list/useNotebooksList';

export type NotebookSort = 'updated' | 'created' | 'alphabetical' | 'reverse-alphabetical';

const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

/**
 * Sorting lives here rather than in useNotebooksList because the list page delegates ordering to its
 * table, which owns the sort state and renders the indicator. A picker has no table, so it needs its
 * own control over the same rows.
 */
export function useNotebookPicker() {
  const list = useNotebooksList({ enabled: true });
  const [sort, setSort] = useState<NotebookSort>('updated');

  const rows = useMemo(() => sortNotebooks(list.rows, sort), [list.rows, sort]);

  return { ...list, rows, sort, setSort };
}

export function getSortOptions(): Array<ComboboxOption<NotebookSort>> {
  return [
    { value: 'updated', label: t('notebooks.add-panel.sort-updated', 'Recently updated') },
    { value: 'created', label: t('notebooks.add-panel.sort-created', 'Recently created') },
    { value: 'alphabetical', label: t('notebooks.add-panel.sort-alphabetical', 'Alphabetically (A–Z)') },
    {
      value: 'reverse-alphabetical',
      label: t('notebooks.add-panel.sort-reverse-alphabetical', 'Alphabetically (Z–A)'),
    },
  ];
}

/** Plain comparison: ISO timestamps order correctly as strings, and locale rules would only muddy it. */
function compareDescending(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  return a > b ? -1 : 1;
}

function sortNotebooks(rows: NotebookRow[], sort: NotebookSort): NotebookRow[] {
  // ISO timestamps sort correctly as plain strings, so the date comparisons need no parsing.
  const sorted = [...rows];

  switch (sort) {
    case 'updated':
      return sorted.sort((a, b) => compareDescending(a.updated, b.updated));
    case 'created':
      return sorted.sort((a, b) => compareDescending(a.created, b.created));
    case 'alphabetical':
      return sorted.sort((a, b) => collator.compare(a.title, b.title));
    case 'reverse-alphabetical':
      return sorted.sort((a, b) => collator.compare(b.title, a.title));
  }
}
