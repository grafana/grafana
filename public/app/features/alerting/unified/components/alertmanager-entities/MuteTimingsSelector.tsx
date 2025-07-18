import { SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { MultiSelect, MultiSelectCommonProps } from '@grafana/ui';
import { useMuteTimings } from 'app/features/alerting/unified/components/mute-timings/useMuteTimings';
import { BaseAlertmanagerArgs } from 'app/features/alerting/unified/types/hooks';
import { timeIntervalToString } from 'app/features/alerting/unified/utils/alertmanager';
import { MuteTimeInterval } from 'app/plugins/datasource/alertmanager/types';

const mapTimeInterval = ({ name, time_intervals }: MuteTimeInterval): SelectableValue<string> => ({
  value: name,
  label: name,
  description: time_intervals.map((interval) => timeIntervalToString(interval)).join(', AND '),
});

/** Provides a MultiSelect with available time intervals for the given alertmanager */
const TimeIntervalSelector = ({
  alertmanager,
  selectProps,
}: BaseAlertmanagerArgs & { selectProps: MultiSelectCommonProps<string> }) => {
  const { data } = useMuteTimings({ alertmanager, skip: selectProps.disabled });

  const timeIntervalOptions = data?.map((value) => mapTimeInterval(value)) || [];

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
