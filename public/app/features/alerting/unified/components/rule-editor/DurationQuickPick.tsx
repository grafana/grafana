import { Button, Stack } from '@grafana/ui';

import { t } from '../../../../../core/internationalization';
import { formatPrometheusDuration, safeParsePrometheusDuration } from '../../utils/time';

interface Props {
  selectedDuration?: string;
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

export function DurationQuickPick({ selectedDuration, groupEvaluationInterval, onSelect }: Props) {
  const isQuickSelectionActive = (duration: string) => selectedDuration === duration;

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
          {duration === '0s' ? t('alerting.duration-quick-pick.none', 'None') : duration}
        </Button>
      ))}
    </Stack>
  );
}
