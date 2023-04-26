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
    // PR TODO: replace this with indeterminate checkbox once its merged in
    return (
      <div
        data-testid={selectors.pages.BrowseDashbards.table.checkbox(item.uid)}
        style={{ width: 16, height: 16, marginRight: 8, background: '#3D71D9', borderRadius: 2 }}
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
