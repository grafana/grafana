import React from 'react';

import { Label, RadioButtonGroup, Tag } from '@grafana/ui';
import { GrafanaAlertState } from 'app/types/unified-alerting-dto';

interface Props {
  className?: string;
  stateFilter?: GrafanaAlertState;
  onStateFilterChange: (value: GrafanaAlertState | undefined) => void;
  itemPerStateStats?: Record<string, number>;
}

export const AlertInstanceStateFilter = React.memo<Props>(
  ({ className, onStateFilterChange, stateFilter, itemPerStateStats }) => {
    const stateOptions = Object.values(GrafanaAlertState).map((value) => ({
      label: value,
      value,
      component: () => {
        return itemPerStateStats && itemPerStateStats[value] ? (
          <Tag name={itemPerStateStats[value].toFixed(0)} colorIndex={9} />
        ) : null;
      },
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
  }
);

AlertInstanceStateFilter.displayName = 'AlertInstanceStateFilter';
