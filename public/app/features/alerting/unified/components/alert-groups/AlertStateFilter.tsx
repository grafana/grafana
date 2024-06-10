import React from 'react';

import { SelectableValue } from '@grafana/data';
import { RadioButtonGroup, Label } from '@grafana/ui';
import { AlertState } from 'app/plugins/datasource/alertmanager/types';

interface Props {
  stateFilter?: AlertState;
  onStateFilterChange: (value: AlertState) => void;
}

export const AlertStateFilter = ({ onStateFilterChange, stateFilter }: Props) => {
  const alertStateOptions: SelectableValue[] = Object.entries(AlertState)
    .sort(([labelA], [labelB]) => (labelA < labelB ? -1 : 1))
    .map(([label, state]) => ({
      label,
      value: state,
    }));

  return (
    <div>
      <Label>State</Label>
      <RadioButtonGroup options={alertStateOptions} value={stateFilter} onChange={onStateFilterChange} />
    </div>
  );
};
