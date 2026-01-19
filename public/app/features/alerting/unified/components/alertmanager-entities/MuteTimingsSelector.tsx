import { SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { MultiSelect, MultiSelectCommonProps } from '@grafana/ui';
import { MuteTiming, useMuteTimings } from 'app/features/alerting/unified/components/mute-timings/useMuteTimings';
import { BaseAlertmanagerArgs } from 'app/features/alerting/unified/types/hooks';
import { timeIntervalToString } from 'app/features/alerting/unified/utils/alertmanager';
import { K8sAnnotations } from 'app/features/alerting/unified/utils/k8s/constants';
import { isImportedResource } from 'app/features/alerting/unified/utils/k8s/utils';

const mapTimeInterval = ({ name, time_intervals }: MuteTiming): SelectableValue<string> => ({
  value: name,
  label: name,
  description: time_intervals.map((interval) => timeIntervalToString(interval)).join(', AND '),
});

/** Check if a time interval was imported from an external Alertmanager */
const isImportedTimeInterval = (timing: MuteTiming): boolean => {
  const provenance = timing.metadata?.annotations?.[K8sAnnotations.Provenance];
  return isImportedResource(provenance);
};

/** Provides a MultiSelect with available time intervals for the given alertmanager */
const TimeIntervalSelector = ({
  alertmanager,
  selectProps,
}: BaseAlertmanagerArgs & { selectProps: MultiSelectCommonProps<string> }) => {
  const { data } = useMuteTimings({ alertmanager, skip: selectProps.disabled });

  // Filter out imported time intervals (provenance === 'prometheus_convert')
  const availableTimings = data?.filter((timing) => !isImportedTimeInterval(timing)) || [];
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
