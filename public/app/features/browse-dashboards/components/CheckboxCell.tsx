import React from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { Checkbox } from '@grafana/ui';

import { DashboardsTreeCellProps, SelectionState } from '../types';

export default function CheckboxCell({
  row: { original: row },
  isSelected,
  onItemSelectionChange,
}: DashboardsTreeCellProps) {
  const item = row.item;

  if (item.kind === 'ui-empty-folder' || !isSelected) {
    return null;
  }

  const state = isSelected(item);

  return (
    <Checkbox
      data-testid={selectors.pages.BrowseDashbards.table.checkbox(item.uid)}
      value={state === SelectionState.Selected}
      indeterminate={state === SelectionState.Mixed}
      onChange={(ev) => onItemSelectionChange?.(item, ev.currentTarget.checked)}
    />
  );
}
