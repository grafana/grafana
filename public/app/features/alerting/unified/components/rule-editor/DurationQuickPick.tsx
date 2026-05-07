import { t } from '@grafana/i18n';
import { Button, Stack } from '@grafana/ui';

import { formatPrometheusDuration, safeParsePrometheusDuration } from '../../utils/time';

interface Props {
  selectedDuration?: string;
  groupEvaluationInterval: string;
  onSelect: (interval: string) => void;
}

export function getPendingPeriodQuickOptions(groupEvaluationInterval: string): string[] {
  const groupEvaluationIntervalMillis = safeParsePrometheusDuration(groupEvaluationInterval);

  // Guard against invalid or incomplete interval strings (e.g. "3" typed mid-keystroke).
  // safeParsePrometheusDuration returns 0 for anything it can't parse, which would make
  // all five multiples equal to 0 and produce duplicate "None" pills in the UI.
  if (groupEvaluationIntervalMillis === 0) {
    return [formatPrometheusDuration(0)];
  }

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
          {stringifyPendingPeriod(duration)}
        </Button>
      ))}
    </Stack>
  );
}

export function stringifyPendingPeriod(duration: string): string {
  return duration === '0s' ? t('alerting.duration-quick-pick.none', 'None') : duration;
}
