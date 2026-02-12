import { SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { MultiSelect, MultiSelectCommonProps } from '@grafana/ui';
import { MuteTiming, useMuteTimings } from 'app/features/alerting/unified/components/mute-timings/useMuteTimings';
import { BaseAlertmanagerArgs } from 'app/features/alerting/unified/types/hooks';
import { timeIntervalToString } from 'app/features/alerting/unified/utils/alertmanager';
import { K8sAnnotations } from 'app/features/alerting/unified/utils/k8s/constants';

const mapTimeInterval = ({ name, time_intervals }: MuteTiming): SelectableValue<string> => ({
  value: name,
  label: name,
  description: time_intervals.map((interval) => timeIntervalToString(interval)).join(', AND '),
});

/** Check if a time interval can be used in routes and rules */
const isUsableTimeInterval = (timing: MuteTiming): boolean => {
  const canUse = timing.metadata?.annotations?.[K8sAnnotations.CanUse];
  return canUse === 'true';
};

/** Provides a MultiSelect with available time intervals for the given alertmanager */
const TimeIntervalSelector = ({
  alertmanager,
  selectProps,
}: BaseAlertmanagerArgs & { selectProps: MultiSelectCommonProps<string> }) => {
  const { data } = useMuteTimings({ alertmanager, skip: selectProps.disabled });

  // Filter to only show usable time intervals (canUse === 'true')
  const availableTimings = data?.filter(isUsableTimeInterval) || [];
  const timeIntervalOptions = availableTimings.map((value) => mapTimeInterval(value));

  return (
    <MultiSelect
      aria-label={t('alerting.time-intervals-selector.aria-label-time-intervals', 'Time intervals')}
      options={timeIntervalOptions}
      placeholder={t('alerting.time-intervals-selector.placeholder-select-time-intervals', 'Select time intervals...')}
      {...selectProps}
    />
  );
};

export default TimeIntervalSelector;
