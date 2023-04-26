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

  const state = isSelected(item.kind, item.uid);

  if (state === SelectionState.Mixed) {
    return (
      <div
        style={{ width: 16, height: 16, marginRight: 8, background: 'blue' }}
        onClick={() => onItemSelectionChange?.(item, false)}
      />
    );
  }

  return (
    <Checkbox
      data-testid={selectors.pages.BrowseDashbards.table.checkbox(item.uid)}
      value={state === SelectionState.Selected}
      onChange={(ev) => onItemSelectionChange?.(item, ev.currentTarget.checked)}
    />
  );
}
