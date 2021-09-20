import { useSelector } from 'react-redux';
import { StoreState } from '../../../../types';

export function useExternalAmSelector() {
  const activeAlertmanagers = useSelector(
    (state: StoreState) => state.unifiedAlerting.externalAlertManagers.activeAlertmanagers.result?.data
  );
  const alertmanagerConfig = useSelector(
    (state: StoreState) => state.unifiedAlerting.externalAlertManagers.alertmanagerConfig.result?.alertmanagers
  );

  if (!activeAlertmanagers || !alertmanagerConfig) {
    return [[], []];
  }

  const enabledAlertmanagers: string[] = [];
  const pendingAlertmanagers: string[] = [];
  const droppedAlertmanagers: string[] = activeAlertmanagers?.droppedAlertManagers.map((am) => am.url);

  for (const alertmanager in activeAlertmanagers.result.data.activeAlertManagers) {
    if (alertmanagerConfig.includes(alertmanager)) {
      enabledAlertmanagers.push(alertmanager);
    } else {
      pendingAlertmanagers.push(alertmanager);
    }
  }

  return [enabledAlertmanagers, pendingAlertmanagers, droppedAlertmanagers];
}
