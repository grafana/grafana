import { type SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { MultiSelect, type MultiSelectCommonProps } from '@grafana/ui';
import {
  type MuteTiming,
  isUsableTimeInterval,
  useMuteTimings,
} from 'app/features/alerting/unified/components/mute-timings/useMuteTimings';
import { type BaseAlertmanagerArgs } from 'app/features/alerting/unified/types/hooks';
import { timeIntervalToString } from 'app/features/alerting/unified/utils/alertmanager';

const mapTimeInterval = (timing: MuteTiming): SelectableValue<string> => {
  const { name, time_intervals } = timing;
  const schedule = time_intervals.map((interval) => timeIntervalToString(interval)).join(', AND ');
  const isUsable = isUsableTimeInterval(timing);

  return {
    value: name,
    label: name,
    // Shown but disabled rather than hidden: filtering imported intervals out leaves the user staring at
    // "No options found" for an interval they can see configured elsewhere.
    isDisabled: !isUsable,
    description: isUsable
      ? schedule
      : t(
          'alerting.time-intervals-selector.imported-not-usable',
          'Imported from an external Alertmanager — promote it to use it here'
        ),
  };
};

/** Provides a MultiSelect with available time intervals for the given alertmanager */
const TimeIntervalSelector = ({
  alertmanager,
  selectProps,
}: BaseAlertmanagerArgs & { selectProps: MultiSelectCommonProps<string> }) => {
  const { data } = useMuteTimings({ alertmanager, skip: selectProps.disabled });

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
