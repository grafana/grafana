import { useMemo, useState } from 'react';

import { t } from '@grafana/i18n';
import { type ComboboxOption } from '@grafana/ui';

import { type NotebookRow, useNotebooksList } from '../list/useNotebooksList';

export type NotebookSort = 'updated' | 'alphabetical' | 'reverse-alphabetical';

const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

/**
 * Sorting lives here rather than in the data hook because it is a view concern: the list page
 * delegates ordering to its table, which owns the sort state and renders the indicator, and a picker
 * has no table.
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
    { value: 'alphabetical', label: t('notebooks.add-panel.sort-alphabetical', 'Alphabetically (A–Z)') },
    {
      value: 'reverse-alphabetical',
      label: t('notebooks.add-panel.sort-reverse-alphabetical', 'Alphabetically (Z–A)'),
    },
  ];
}

/** Unix millis, so newest first is a plain numeric descent. */
function compareDescending(a: number, b: number): number {
  return b - a;
}

/**
 * Sorted here rather than by the server: `updated` is retrieve-only in the search index and a request
 * that sorts on it is rejected. The rows are the whole result set - the hook follows the cursor to the
 * end - so ordering them locally is the same answer, which is what the list page's table does too.
 */
function sortNotebooks(rows: NotebookRow[], sort: NotebookSort): NotebookRow[] {
  const sorted = [...rows];

  switch (sort) {
    case 'updated':
      return sorted.sort((a, b) => compareDescending(a.updated, b.updated));
    case 'alphabetical':
      return sorted.sort((a, b) => collator.compare(a.title, b.title));
    case 'reverse-alphabetical':
      return sorted.sort((a, b) => collator.compare(b.title, a.title));
  }
}
