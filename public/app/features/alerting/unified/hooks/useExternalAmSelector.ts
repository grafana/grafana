import { useSelector } from 'react-redux';
import { StoreState } from '../../../../types';

export function useExternalAmSelector(): Array<{ url: string; status: string }> | undefined {
  const activeAlertmanagers = useSelector(
    (state: StoreState) => state.unifiedAlerting.externalAlertmanagers.activeAlertmanagers.result?.data
  );
  const alertmanagerConfig = useSelector(
    (state: StoreState) => state.unifiedAlerting.externalAlertmanagers.alertmanagerConfig.result?.alertmanagers
  );

  if (!activeAlertmanagers || !alertmanagerConfig) {
    return;
  }

  const enabledAlertmanagers: Array<{ url: string; status: string }> = [];
  const droppedAlertmanagers: Array<{ url: string; status: string }> = activeAlertmanagers?.droppedAlertManagers.map(
    (am) => ({
      url: am.url,
      status: 'dropped',
    })
  );

  for (const url of alertmanagerConfig) {
    if (activeAlertmanagers.activeAlertManagers.length === 0) {
      enabledAlertmanagers.push({
        url: `${url}/api/v2/alerts`,
        status: 'pending',
      });
    }
    for (const activeAM of activeAlertmanagers.activeAlertManagers) {
      if (activeAM.url === `${url}/api/v2/alerts`) {
        enabledAlertmanagers.push({
          url: activeAM.url,
          status: 'active',
        });
      } else {
        enabledAlertmanagers.push({
          url: `${url}/api/v2/alerts`,
          status: 'pending',
        });
      }
    }
  }

  return [...enabledAlertmanagers, ...droppedAlertmanagers];
}
