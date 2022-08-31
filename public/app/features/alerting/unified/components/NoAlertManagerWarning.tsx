import React from 'react';

import { Alert } from '@grafana/ui';

import { useAlertManagerSourceName } from '../hooks/useAlertManagerSourceName';
import { AlertManagerDataSource } from '../utils/datasource';

import { AlertManagerPicker } from './AlertManagerPicker';

interface Props {
  availableAlertManagers: AlertManagerDataSource[];
}

const NoAlertManagersAvailable = () => (
  <Alert title="No Alertmanager found" severity="warning">
    We could not find any external Alertmanagers and you may not have access to the built-in Grafana Alertmanager.
  </Alert>
);

const OtherAlertManagersAvailable = () => (
  <Alert title="Selected Alertmanager not found. Select a different Alertmanager." severity="warning">
    Selected Alertmanager no longer exists or you may not have permission to access it.
  </Alert>
);

export const NoAlertManagerWarning = ({ availableAlertManagers }: Props) => {
  const [_, setAlertManagerSourceName] = useAlertManagerSourceName(availableAlertManagers);
  const hasOtherAMs = availableAlertManagers.length > 0;

  return (
    <div>
      {hasOtherAMs ? (
        <>
          <AlertManagerPicker onChange={setAlertManagerSourceName} dataSources={availableAlertManagers} />
          <OtherAlertManagersAvailable />
        </>
      ) : (
        <NoAlertManagersAvailable />
      )}
    </div>
  );
};
