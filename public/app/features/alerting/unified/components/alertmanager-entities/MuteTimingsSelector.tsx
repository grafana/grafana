import { SelectableValue } from '@grafana/data';
import { MultiSelect, MultiSelectCommonProps } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { useMuteTimings } from 'app/features/alerting/unified/components/mute-timings/useMuteTimings';
import { BaseAlertmanagerArgs } from 'app/features/alerting/unified/types/hooks';
import { timeIntervalToString } from 'app/features/alerting/unified/utils/alertmanager';
import { MuteTimeInterval } from 'app/plugins/datasource/alertmanager/types';

const mapMuteTiming = ({ name, time_intervals }: MuteTimeInterval): SelectableValue<string> => ({
  value: name,
  label: name,
  description: time_intervals.map((interval) => timeIntervalToString(interval)).join(', AND '),
});

/** Provides a MultiSelect with available mute timings for the given alertmanager */
const MuteTimingsSelector = ({
  alertmanager,
  selectProps,
}: BaseAlertmanagerArgs & { selectProps: MultiSelectCommonProps<string> }) => {
  const { data } = useMuteTimings({ alertmanager, skip: selectProps.disabled });

  const muteTimingOptions = data?.map((value) => mapMuteTiming(value)) || [];

  return (
    <MultiSelect
      aria-label={t('alerting.mute-timings-selector.aria-label-mute-timings', 'Mute timings')}
      options={muteTimingOptions}
      placeholder={t('alerting.mute-timings-selector.placeholder-select-mute-timings', 'Select mute timings...')}
      {...selectProps}
    />
  );
};

export default MuteTimingsSelector;
