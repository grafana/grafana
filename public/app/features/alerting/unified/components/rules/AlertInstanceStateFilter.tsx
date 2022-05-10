import React from 'react';

import { SelectableValue } from '@grafana/data';
import { RadioButtonGroup, Label } from '@grafana/ui';
import { GrafanaAlertState } from 'app/types/unified-alerting-dto';

interface Props {
  className?: string;
  stateFilter?: GrafanaAlertState;
  onStateFilterChange: (value: GrafanaAlertState | undefined) => void;
}

export const AlertInstanceStateFilter = ({ className, onStateFilterChange, stateFilter }: Props) => {
  // Group our state options together by their "prefix", like Normal from
  // "Normal" and "Normal (NoData)". In the filter of the table, we select all
  // states that match the prefix.
  type RType = Array<SelectableValue<GrafanaAlertState>>;
  const stateOptions = Object.values(GrafanaAlertState)
    .reduce<RType>((prev: RType, value): RType => {
      prev.push({
        label: value,
        value,
      });
      return prev;
    }, [] as RType)
    .filter((v) => !v.value?.includes('('));

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
