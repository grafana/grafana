import { type SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { SortOrder } from 'app/core/utils/richHistoryTypes';

export const getRecentQueriesSortOptions = (): Promise<SelectableValue[]> => {
  return Promise.resolve([
    { label: t('recent-queries.sort-option.newest', 'Sort Newest'), value: SortOrder.Descending },
    { label: t('recent-queries.sort-option.oldest', 'Sort Oldest'), value: SortOrder.Ascending },
  ]);
};
