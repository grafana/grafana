import { t } from '@grafana/i18n';
import { MultiSelect } from '@grafana/ui';

import { useListTimeIntervals } from '../../../muteTimings/hooks/useListTimeIntervals';

export interface TimeIntervalsSelectProps {
  /** Plain time interval names. */
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  'aria-label'?: string;
}

/** Multi-select over the available time intervals. Mute and active timings pick from the same resource,
 * so callers use one instance per field. A failed fetch is reported inside the dropdown. */
export function TimeIntervalsSelect({ value, onChange, disabled, 'aria-label': ariaLabel }: TimeIntervalsSelectProps) {
  const { timeIntervals, isLoading, isError } = useListTimeIntervals();

  // Unusable intervals stay visible but disabled, so users can see why a configured interval isn't offered.
  const options = timeIntervals.map(({ name, canUse }) => ({
    label: name,
    value: name,
    isDisabled: !canUse,
    description: canUse
      ? undefined
      : t(
          'alerting.time-intervals-select.imported-not-usable',
          'Imported from an external Alertmanager — promote it to use it here'
        ),
  }));

  return (
    <MultiSelect
      aria-label={ariaLabel}
      placeholder={t('alerting.time-intervals-select.placeholder', 'Select time intervals...')}
      options={options}
      isLoading={isLoading}
      noOptionsMessage={
        isError ? t('alerting.time-intervals-select.error', 'Could not load time intervals') : undefined
      }
      value={value}
      onChange={(opts) => onChange(opts.map((opt) => opt.value ?? ''))}
      disabled={disabled}
    />
  );
}
