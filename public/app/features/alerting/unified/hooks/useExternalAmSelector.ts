import { useSelector } from 'react-redux';
import { StoreState } from '../../../../types';

export function useExternalAmSelector(): Array<{ url: string; status: string }> {
  const activeAlertmanagers = useSelector(
    (state: StoreState) => state.unifiedAlerting.externalAlertManagers.activeAlertmanagers.result?.data
  );
  const alertmanagerConfig = useSelector(
    (state: StoreState) => state.unifiedAlerting.externalAlertManagers.alertmanagerConfig.result?.alertmanagers
  );

  if (!activeAlertmanagers || !alertmanagerConfig) {
    return [{ url: '', status: '' }];
  }

  const enabledAlertmanagers: Array<{ url: string; status: string }> = [];
  const droppedAlertmanagers: Array<{ url: string; status: string }> = activeAlertmanagers?.droppedAlertManagers.map(
    (am) => ({
      url: am.url,
      status: 'dropped',
    })
  );

  for (const alertmanager of activeAlertmanagers.activeAlertManagers) {
    if (alertmanagerConfig.includes(alertmanager.url)) {
      enabledAlertmanagers.push({ url: alertmanager.url, status: 'active' });
    } else {
      enabledAlertmanagers.push({ url: alertmanager.url, status: 'pending' });
    }
  }

  return [...enabledAlertmanagers, ...droppedAlertmanagers];
}
