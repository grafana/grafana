import { useCallback } from 'react';

import { SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Select } from '@grafana/ui';

import { useURLSearchParams } from '../../hooks/useURLSearchParams';

export enum RuleSortOrder {
  AlphaAsc = 'alpha-asc',
  AlphaDesc = 'alpha-desc',
  StateAsc = 'state-asc',
  StateDesc = 'state-desc',
  CreatedAsc = 'created-asc',
  CreatedDesc = 'created-desc',
  UpdatedAsc = 'updated-asc',
  UpdatedDesc = 'updated-desc',
}

const SORT_OPTIONS: Array<SelectableValue<RuleSortOrder>> = [
  { label: 'Alphabetically (A-Z)', value: RuleSortOrder.AlphaAsc },
  { label: 'Alphabetically (Z-A)', value: RuleSortOrder.AlphaDesc },
  { label: 'State (Firing first)', value: RuleSortOrder.StateAsc },
  { label: 'State (Normal first)', value: RuleSortOrder.StateDesc },
  { label: 'Created (Newest first)', value: RuleSortOrder.CreatedDesc },
  { label: 'Created (Oldest first)', value: RuleSortOrder.CreatedAsc },
  { label: 'Updated (Newest first)', value: RuleSortOrder.UpdatedDesc },
  { label: 'Updated (Oldest first)', value: RuleSortOrder.UpdatedAsc },
];

export function useRulesSorting() {
  const [queryParams, updateQueryParams] = useURLSearchParams();

  const sortOrder = parseRuleSortOrder(queryParams.get('sort'));

  const setSortOrder = useCallback(
    (order: RuleSortOrder | undefined) => {
      updateQueryParams({ sort: order });
    },
    [updateQueryParams]
  );

  return { sortOrder, setSortOrder };
}

function parseRuleSortOrder(value: string | null): RuleSortOrder | undefined {
  if (value && Object.values(RuleSortOrder).includes(value as RuleSortOrder)) {
    return value as RuleSortOrder;
  }
  return undefined;
}

interface RulesSortingSelectorProps {
  sortOrder: RuleSortOrder | undefined;
  onSortOrderChange: (sortOrder: RuleSortOrder | undefined) => void;
}

export function RulesSortingSelector({ sortOrder, onSortOrderChange }: RulesSortingSelectorProps) {
  return (
    <Select
      aria-label={t('alerting.rules-sorting-selector.aria-label', 'Sort alert rules')}
      options={SORT_OPTIONS}
      value={sortOrder}
      onChange={(option) => onSortOrderChange(option?.value)}
      placeholder={t('alerting.rules-sorting-selector.placeholder', 'Sort by...')}
      isClearable
      width={24}
    />
  );
}
