import { useSelector } from 'react-redux';
import { StoreState } from '../../../../types';

const SUFFIX_REGEX = /\/api\/v[1|2]\/alerts/i;
type AlertmanagerConfig = { url: string; status: string; actualUrl: string };

export function useExternalAmSelector(): AlertmanagerConfig[] | undefined {
  const discoveredAlertmanagers = useSelector(
    (state: StoreState) => state.unifiedAlerting.externalAlertmanagers.discoveredAlertmanagers.result?.data
  );
  const alertmanagerConfig = useSelector(
    (state: StoreState) => state.unifiedAlerting.externalAlertmanagers.alertmanagerConfig.result?.alertmanagers
  );

  if (!discoveredAlertmanagers || !alertmanagerConfig) {
    return [];
  }

  const enabledAlertmanagers: AlertmanagerConfig[] = [];
  const droppedAlertmanagers: AlertmanagerConfig[] = discoveredAlertmanagers?.droppedAlertManagers.map((am) => ({
    url: am.url.replace(SUFFIX_REGEX, ''),
    status: 'dropped',
    actualUrl: am.url,
  }));

  for (const url of alertmanagerConfig) {
    if (discoveredAlertmanagers.activeAlertManagers.length === 0) {
      enabledAlertmanagers.push({
        url: url,
        status: 'pending',
        actualUrl: '',
      });
    } else {
      let found = false;
      for (const activeAM of discoveredAlertmanagers.activeAlertManagers) {
        if (activeAM.url === `${url}/api/v2/alerts`) {
          found = true;
          enabledAlertmanagers.push({
            url: activeAM.url.replace(SUFFIX_REGEX, ''),
            status: 'active',
            actualUrl: activeAM.url,
          });
        }
      }
      if (!found) {
        enabledAlertmanagers.push({
          url: url,
          status: 'pending',
          actualUrl: '',
        });
      }
    }
  }

  return [...enabledAlertmanagers, ...droppedAlertmanagers];
}
