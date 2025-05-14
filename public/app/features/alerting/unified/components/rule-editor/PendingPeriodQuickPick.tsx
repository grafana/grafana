import { Button, Stack } from '@grafana/ui';

import { formatPrometheusDuration, safeParsePrometheusDuration } from '../../utils/time';

interface Props {
  selectedPendingPeriod: string;
  groupEvaluationInterval: string;
  onSelect: (interval: string) => void;
}

export function getPendingPeriodQuickOptions(groupEvaluationInterval: string): string[] {
  const groupEvaluationIntervalMillis = safeParsePrometheusDuration(groupEvaluationInterval);

  // we generate the quick selection based on the group's evaluation interval
  const options: number[] = [
    0,
    groupEvaluationIntervalMillis * 1,
    groupEvaluationIntervalMillis * 2,
    groupEvaluationIntervalMillis * 3,
    groupEvaluationIntervalMillis * 4,
    groupEvaluationIntervalMillis * 5,
  ];

  return options.map(formatPrometheusDuration);
}

export function PendingPeriodQuickPick({ selectedPendingPeriod, groupEvaluationInterval, onSelect }: Props) {
  const isQuickSelectionActive = (duration: string) => selectedPendingPeriod === duration;

  const options = getPendingPeriodQuickOptions(groupEvaluationInterval);

  return (
    <Stack direction="row" gap={0.5} role="listbox">
      {options.map((duration) => (
        <Button
          role="option"
          aria-selected={isQuickSelectionActive(duration)}
          key={duration}
          variant={isQuickSelectionActive(duration) ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => {
            onSelect(duration);
          }}
        >
          {duration === '0s' ? 'None' : duration}
        </Button>
      ))}
    </Stack>
  );
}
