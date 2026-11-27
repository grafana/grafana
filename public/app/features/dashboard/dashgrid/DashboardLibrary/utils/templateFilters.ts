import { type SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';

import { type TemplateSortOrder } from '../types';

const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

/** The template modal's sort options, by title. */
export function getTemplateSortOptions(): Promise<Array<SelectableValue<TemplateSortOrder>>> {
  return Promise.resolve([
    { value: 'asc', label: t('dashboard-library.custom-dashboard-template-filters.sort.asc', 'Alphabetically (A–Z)') },
    {
      value: 'desc',
      label: t('dashboard-library.custom-dashboard-template-filters.sort.desc', 'Alphabetically (Z–A)'),
    },
  ]);
}

/** Keeps the templates whose title or description contains `searchQuery`, ignoring case, sorted by title. */
export function filterTemplates<T>(
  items: T[],
  getTitle: (item: T) => string,
  getDescription: (item: T) => string | undefined,
  searchQuery = '',
  sortOrder?: TemplateSortOrder
): T[] {
  const query = searchQuery.trim().toLowerCase();
  const matches = query
    ? items.filter(
        (item) =>
          getTitle(item).toLowerCase().includes(query) || (getDescription(item) ?? '').toLowerCase().includes(query)
      )
    : items;
  if (!sortOrder) {
    return matches;
  }
  const direction = sortOrder === 'asc' ? 1 : -1;
  return [...matches].sort((a, b) => direction * collator.compare(getTitle(a), getTitle(b)));
}
