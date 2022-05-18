import React from 'react';

import { RadioButtonGroup, Label } from '@grafana/ui';
import { GrafanaAlertState } from 'app/types/unified-alerting-dto';

interface Props {
  className?: string;
  stateFilter?: GrafanaAlertState;
  onStateFilterChange: (value: GrafanaAlertState | undefined) => void;
}

export const AlertInstanceStateFilter = ({ className, onStateFilterChange, stateFilter }: Props) => {
  const stateOptions = Object.values(GrafanaAlertState).map((value) => ({
    label: value,
    value,
  }));

  return (
    <div className={className}>
      <Label>State</Label>
      <RadioButtonGroup
        options={stateOptions}
        value={stateFilter}
        onChange={onStateFilterChange}
        onClick={(v) => {
          if (v === stateFilter) {
            onStateFilterChange(undefined);
          }
        }}
      />
    </div>
  );
};
