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

/** Multi-select over the available time intervals. Mute and active timings both pick from the same
 * resource, so callers use one instance per field. A failed fetch is reported inside the dropdown, once per select. */
export function TimeIntervalsSelect({ value, onChange, disabled, 'aria-label': ariaLabel }: TimeIntervalsSelectProps) {
  const { currentData: timeIntervals, isLoading, isError } = useListTimeIntervals();

  // Rules reference a time interval by its title (spec.name), which can differ from metadata.name.
  const options = (timeIntervals?.items ?? []).map((ti) => ({ label: ti.spec.name, value: ti.spec.name }));

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
