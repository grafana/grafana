import { useMemo, useState } from 'react';

import { t } from '@grafana/i18n';
import { type ComboboxOption } from '@grafana/ui';

import { type NotebookRow, useNotebooksList } from '../list/useNotebooksList';

export type NotebookSort = 'updated' | 'created' | 'alphabetical' | 'reverse-alphabetical';

const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

/**
 * Sorting lives here rather than in the data hook because it is a view concern: the list page
 * delegates ordering to its table, which owns the sort state and renders the indicator, and a picker
 * has no table.
 */
export function useNotebookPicker() {
  // Tag facets because the picker offers a tag filter; the list page does not, so it does not ask.
  const list = useNotebooksList({ enabled: true, tagFacets: true });
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

/** Unix millis, so newest first is a plain numeric descent. */
function compareDescending(a: number, b: number): number {
  return b - a;
}

/**
 * Sorted here rather than by the server: `created` and `updated` are retrieve-only in the search
 * index and a request that sorts on them is rejected. The rows are the whole result set - the hook
 * follows the cursor to the end - so ordering them locally is the same answer, which is what the
 * list page's table does with them too.
 */
function sortNotebooks(rows: NotebookRow[], sort: NotebookSort): NotebookRow[] {
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
