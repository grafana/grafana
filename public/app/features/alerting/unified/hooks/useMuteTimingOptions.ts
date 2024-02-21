import { useMemo } from 'react';

import { SelectableValue } from '@grafana/data';

import { useAlertmanager } from '../state/AlertmanagerContext';
import { timeIntervalToString } from '../utils/alertmanager';

import { useAlertmanagerConfig } from './useAlertmanagerConfig';

export function useMuteTimingOptions(): Array<SelectableValue<string>> {
  const { selectedAlertmanager } = useAlertmanager();
  const { currentData } = useAlertmanagerConfig(selectedAlertmanager);
  const config = currentData?.alertmanager_config;

  return useMemo(() => {
    const time_intervals = config?.mute_time_intervals ?? config?.time_intervals;
    const muteTimingsOptions: Array<SelectableValue<string>> =
      time_intervals?.map((value) => ({
        value: value.name,
        label: value.name,
        description: value.time_intervals.map((interval) => timeIntervalToString(interval)).join(', AND '),
      })) ?? [];

    return muteTimingsOptions;
  }, [config]);
}
