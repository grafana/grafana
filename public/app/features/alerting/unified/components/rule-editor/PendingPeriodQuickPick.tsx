import React from 'react';

import { Button } from '@grafana/ui';

import { formatPrometheusDuration, parsePrometheusDuration, safeParsePrometheusDuration } from '../../utils/time';

interface Props {
  selectedPendingPeriod: string;
  groupEvaluationInterval: string;
  onSelect: (interval: string) => void;
}

export function PendingPeriodQuickPick({ selectedPendingPeriod, groupEvaluationInterval, onSelect }: Props) {
  // @TODO maybe safe parse?
  const groupEvaluationIntervalMillis = parsePrometheusDuration(groupEvaluationInterval);

  // we generate the quick selection based on the group's evaluation interval
  const PENDING_PERIOD_QUICK_OPTIONS: number[] = [
    0,
    groupEvaluationIntervalMillis * 1,
    groupEvaluationIntervalMillis * 2,
    groupEvaluationIntervalMillis * 3,
    groupEvaluationIntervalMillis * 4,
    groupEvaluationIntervalMillis * 5,
  ];

  const isQuickSelectionActive = (milliseconds: number) => {
    return safeParsePrometheusDuration(selectedPendingPeriod) === milliseconds;
  };

  return PENDING_PERIOD_QUICK_OPTIONS.map((milliseconds) => (
    <Button
      key={milliseconds}
      variant={isQuickSelectionActive(milliseconds) ? 'primary' : 'secondary'}
      size="sm"
      onClick={() => {
        onSelect(formatPrometheusDuration(milliseconds));
      }}
    >
      {milliseconds === 0 ? 'None' : formatPrometheusDuration(milliseconds)}
    </Button>
  ));
}
