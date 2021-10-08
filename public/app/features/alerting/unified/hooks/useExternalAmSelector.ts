import { useSelector } from 'react-redux';
import { StoreState } from '../../../../types';

export function useExternalAmSelector(): Array<{ url: string; status: string }> {
  const activeAlertmanagers = useSelector(
    (state: StoreState) => state.unifiedAlerting.externalAlertmanagers.activeAlertmanagers.result?.data
  );
  const alertmanagerConfig = useSelector(
    (state: StoreState) => state.unifiedAlerting.externalAlertmanagers.alertmanagerConfig.result?.alertmanagers
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

  // const enabledAlertmanagers = activeAlertmanagers.activeAlertManagers.map((alertmanager) => {
  //   alertmanagerConfig.find((url) => alertmanager.url === `${url}/api/v2/alerts`);
  //   for (const url in alertmanagerConfig) {
  //     if (alertmanager.url === `${url}/api/v2/alerts`) {
  //       return {
  //         url: alertmanager.url,
  //         status: 'active',
  //       };
  //     } else {
  //       return {
  //         url: `${url}/api/v2/alerts`,
  //         status: 'pending',
  //       };
  //     }
  //   }
  // });

  return [...enabledAlertmanagers, ...droppedAlertmanagers];
}
