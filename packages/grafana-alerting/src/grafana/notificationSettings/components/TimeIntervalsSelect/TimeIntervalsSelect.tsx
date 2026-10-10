import { t } from '@grafana/i18n';
import { MultiSelect } from '@grafana/ui';

import { type TimeInterval } from '../../../api/notifications';
import { useListTimeIntervals } from '../../../muteTimings/hooks/useListTimeIntervals';

// Imported intervals belong to an external Alertmanager and are rejected by rule validation.
const isUsable = (timeInterval: TimeInterval) => timeInterval.metadata.annotations?.['grafana.com/canUse'] === 'true';

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
  const {
    currentData: timeIntervals,
    isLoading,
    isError,
  } = useListTimeIntervals({}, { refetchOnFocus: true, refetchOnMountOrArgChange: true });

  // Rules reference a time interval by its title (spec.name), which can differ from metadata.name.
  // Unusable intervals stay visible but disabled, so users can see why a configured interval isn't offered.
  const options = (timeIntervals?.items ?? []).map((ti) => ({
    label: ti.spec.name,
    value: ti.spec.name,
    isDisabled: !isUsable(ti),
    description: isUsable(ti)
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
