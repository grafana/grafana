import { useListTimeIntervals } from '@grafana/alerting/unstable';
import { t } from '@grafana/i18n';
import { MultiSelect, type MultiSelectCommonProps } from '@grafana/ui';
import { mapMultiSelectValueToStrings } from 'app/features/alerting/unified/utils/amroutes';

interface TimeIntervalsSelectProps extends Omit<MultiSelectCommonProps<string>, 'options' | 'onChange'> {
  onChange: (names: string[]) => void;
}

export function TimeIntervalsSelect({ onChange, ...props }: TimeIntervalsSelectProps) {
  const { status, timeIntervals } = useListTimeIntervals({ skip: props.disabled });

  // Shown but disabled rather than hidden: filtering imported intervals out leaves the user staring at
  // "No options found" for an interval they can see configured elsewhere.
  const options = timeIntervals.map(({ name, isImported }) => ({
    value: name,
    label: name,
    isDisabled: isImported,
    description: isImported
      ? t(
          'alerting.time-intervals-selector.imported-not-usable',
          'Imported from an external Alertmanager — promote it to use it here'
        )
      : undefined,
  }));

  return (
    <MultiSelect
      aria-label={t('alerting.time-intervals-selector.aria-label-time-intervals', 'Time intervals')}
      placeholder={t('alerting.time-intervals-selector.placeholder-select-time-intervals', 'Select time intervals...')}
      {...props}
      options={options}
      isLoading={status === 'resolving'}
      onChange={(selected) => onChange(mapMultiSelectValueToStrings(selected))}
    />
  );
}
