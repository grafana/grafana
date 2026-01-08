import { useMemo } from 'react';
import { useFormContext } from 'react-hook-form';

import { AlertmanagerProvider } from 'app/features/alerting/unified/state/AlertmanagerContext';
import { RuleFormValues } from 'app/features/alerting/unified/types/rule-form';
import { getAlertManagerDataSourcesByPermission } from 'app/features/alerting/unified/utils/datasource';

import { AlertManagerManualRouting } from './AlertManagerRouting';

export function SimplifiedRouting() {
  const { getValues } = useFormContext<RuleFormValues>();
  const contactPointsInAlert = getValues('contactPoints');

  const allAlertManagersByPermission = getAlertManagerDataSourcesByPermission('notification');

  // We decided to only show internal alert manager for now. Once we want to show external alert managers we can use this code
  // const alertManagersDataSources = allAlertManagersByPermission.availableInternalDataSources.concat(
  //   allAlertManagersByPermission.availableExternalDataSources
  // );

  const alertManagersDataSources = allAlertManagersByPermission.availableInternalDataSources;

  const alertManagersDataSourcesWithConfigAPI = alertManagersDataSources.filter((am) => am.hasConfigurationAPI);

  // we merge the selected contact points data for each alert manager, with the alert manager meta data
  const alertManagersWithSelectedContactPoints = useMemo(
    () =>
      alertManagersDataSourcesWithConfigAPI.map((am) => {
        const selectedContactPoint = contactPointsInAlert ? contactPointsInAlert[am.name] : undefined;
        return {
          alertManager: am,
          selectedContactPoint: selectedContactPoint?.selectedContactPoint ?? '',
          routeSettings: {
            muteTimeIntervals: selectedContactPoint?.muteTimeIntervals ?? [],
            activeTimeIntervals: selectedContactPoint?.activeTimeIntervals ?? [],
            overrideGrouping: selectedContactPoint?.overrideGrouping ?? false,
            groupBy: selectedContactPoint?.groupBy ?? [],
            overrideTimings: selectedContactPoint?.overrideTimings ?? false,
            groupWaitValue: selectedContactPoint?.groupWaitValue ?? '',
            groupIntervalValue: selectedContactPoint?.groupIntervalValue ?? '',
            repeatIntervalValue: selectedContactPoint?.repeatIntervalValue ?? '',
          },
        };
      }),
    [alertManagersDataSourcesWithConfigAPI, contactPointsInAlert]
  );

  return alertManagersWithSelectedContactPoints.map((alertManagerContactPoint, index) => {
    return (
      <AlertmanagerProvider
        accessType={'notification'}
        alertmanagerSourceName={alertManagerContactPoint.alertManager.name}
        key={alertManagerContactPoint.alertManager.name + index}
      >
        <AlertManagerManualRouting alertManager={alertManagerContactPoint.alertManager} />
      </AlertmanagerProvider>
    );
  });
}
