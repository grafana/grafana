import { capitalize } from 'lodash';
import React from 'react';

import { Label, RadioButtonGroup, Tag } from '@grafana/ui';
import { GrafanaAlertState, PromAlertingRuleState } from 'app/types/unified-alerting-dto';

export type InstanceStateFilter = GrafanaAlertState | PromAlertingRuleState.Pending | PromAlertingRuleState.Firing;

interface Props {
  className?: string;
  filterType: 'grafana' | 'prometheus';
  stateFilter?: InstanceStateFilter;
  onStateFilterChange: (value?: InstanceStateFilter) => void;
  itemPerStateStats?: Record<string, number>;
}

export const AlertInstanceStateFilter = ({
  className,
  onStateFilterChange,
  stateFilter,
  filterType,
  itemPerStateStats,
}: Props) => {
  const grafanaOptions = Object.values(GrafanaAlertState).map((value) => ({
    label: value,
    value,
    component: () => {
      return itemPerStateStats && itemPerStateStats[value] ? (
        <Tag name={itemPerStateStats[value].toFixed(0)} colorIndex={9} />
      ) : null;
    },
  }));

  const promOptionValues = [PromAlertingRuleState.Firing, PromAlertingRuleState.Pending] as const;
  const promOptions = promOptionValues.map((state) => ({
    label: capitalize(state),
    value: state,
    component: () => {
      return itemPerStateStats && itemPerStateStats[state] ? (
        <Tag name={itemPerStateStats[state].toFixed(0)} colorIndex={9} />
      ) : null;
    },
  }));

  const stateOptions = filterType === 'grafana' ? grafanaOptions : promOptions;

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
