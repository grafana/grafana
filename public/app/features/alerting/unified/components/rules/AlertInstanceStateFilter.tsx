import { capitalize } from 'lodash';
import React, { useMemo } from 'react';

import { Label, RadioButtonGroup } from '@grafana/ui';
import { GrafanaAlertState, PromAlertingRuleState } from 'app/types/unified-alerting-dto';

export type InstanceStateFilter = GrafanaAlertState | PromAlertingRuleState.Pending | PromAlertingRuleState.Firing;

interface Props {
  className?: string;
  filterType: 'grafana' | 'prometheus';
  stateFilter?: InstanceStateFilter;
  onStateFilterChange: (value?: InstanceStateFilter) => void;
}

const grafanaOptions = Object.values(GrafanaAlertState).map((value) => ({
  label: value,
  value,
}));

const promOptionValues = [PromAlertingRuleState.Firing, PromAlertingRuleState.Pending] as const;
const promOptions = promOptionValues.map((state) => ({
  label: capitalize(state),
  value: state,
}));

export const AlertInstanceStateFilter = ({ className, onStateFilterChange, stateFilter, filterType }: Props) => {
  const stateOptions = useMemo(() => (filterType === 'grafana' ? grafanaOptions : promOptions), [filterType]);

  return (
    <div className={className} data-testid="alert-instance-state-filter">
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
