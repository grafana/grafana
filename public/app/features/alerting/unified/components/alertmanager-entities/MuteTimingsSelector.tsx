import type { SelectableValue } from '@grafana/data/types';
import { t } from '@grafana/i18n';
import { MultiSelect, type MultiSelectCommonProps } from '@grafana/ui';
import { type MuteTiming, useMuteTimings } from 'app/features/alerting/unified/components/mute-timings/useMuteTimings';
import { type BaseAlertmanagerArgs } from 'app/features/alerting/unified/types/hooks';
import { timeIntervalToString } from 'app/features/alerting/unified/utils/alertmanager';

const mapTimeInterval = ({ name, time_intervals }: MuteTiming): SelectableValue<string> => ({
  value: name,
  label: name,
  description: time_intervals.map((interval) => timeIntervalToString(interval)).join(', AND '),
});

/** Provides a MultiSelect with available time intervals for the given alertmanager */
const TimeIntervalSelector = ({
  alertmanager,
  selectProps,
}: BaseAlertmanagerArgs & { selectProps: MultiSelectCommonProps<string> }) => {
  const { data } = useMuteTimings({ alertmanager, skip: selectProps.disabled, filterUsable: true });

  const timeIntervalOptions = (data || []).map((value) => mapTimeInterval(value));

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
