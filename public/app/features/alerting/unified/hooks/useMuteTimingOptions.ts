import { useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { AlertmanagerConfig } from 'app/plugins/datasource/alertmanager/types';

import { timeIntervalToString } from '../utils/alertmanager';
import { initialAsyncRequestState } from '../utils/redux';

import { useAlertManagerSourceName } from './useAlertManagerSourceName';
import { useAlertManagersByPermission } from './useAlertManagerSources';
import { useUnifiedAlertingSelector } from './useUnifiedAlertingSelector';

export function useMuteTimingOptions(): Array<SelectableValue<string>> {
  const alertManagers = useAlertManagersByPermission('notification');
  const [alertManagerSourceName] = useAlertManagerSourceName(alertManagers);
  const amConfigs = useUnifiedAlertingSelector((state) => state.amConfigs);

  return useMemo(() => {
    const { result } = (alertManagerSourceName && amConfigs[alertManagerSourceName]) || initialAsyncRequestState;
    const config: AlertmanagerConfig = result?.alertmanager_config ?? {};

    const muteTimingsOptions: Array<SelectableValue<string>> =
      config?.mute_time_intervals?.map((value) => ({
        value: value.name,
        label: value.name,
        description: value.time_intervals.map((interval) => timeIntervalToString(interval)).join(', AND '),
      })) ?? [];

    return muteTimingsOptions;
  }, [alertManagerSourceName, amConfigs]);
}
