import { SelectableValue } from '@grafana/data';
import { MultiSelect, MultiSelectCommonProps } from '@grafana/ui';
import { useSelectableMuteTimings } from 'app/features/alerting/unified/components/mute-timings/useMuteTimings';
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
  const { data } = useSelectableMuteTimings({ alertmanager, skip: selectProps.disabled });

  const muteTimingOptions = data?.map((value) => mapMuteTiming(value)) || [];

  return (
    <MultiSelect
      aria-label="Mute timings"
      options={muteTimingOptions}
      placeholder="Select mute timings..."
      {...selectProps}
    />
  );
};

export default MuteTimingsSelector;
