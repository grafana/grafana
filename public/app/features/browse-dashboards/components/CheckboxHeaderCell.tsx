import React from 'react';

import { Checkbox } from '@grafana/ui';

import { DashboardTreeHeaderProps, SelectionState } from '../types';

export default function CheckboxHeaderCell({ isSelected, onAllSelectionChange }: DashboardTreeHeaderProps) {
  const state = isSelected?.('$all') ?? SelectionState.Unselected;

  return (
    <Checkbox
      value={state === SelectionState.Selected}
      indeterminate={state === SelectionState.Mixed}
      onChange={(ev) => onAllSelectionChange?.(ev.currentTarget.checked)}
    />
  );
}
