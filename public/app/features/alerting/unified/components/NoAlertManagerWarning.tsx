import React from 'react';

import { Alert } from '@grafana/ui';

import { useAlertManagerSourceName } from '../hooks/useAlertManagerSourceName';
import { AlertManagerDataSource } from '../utils/datasource';

import { AlertManagerPicker } from './AlertManagerPicker';

interface Props {
  availableAlertManagers: AlertManagerDataSource[];
}

const NoAlertManagersAvailable = () => (
  <Alert title="No alert managers available" severity="warning">
    There are no alert managers available. Probably there are no external alert managers configured and you do not have
    access to built-in Grafana Alert Manager
  </Alert>
);

const OtherAlertManagersAvailable = () => (
  <Alert title="The selected alert manager is not available" severity="warning">
    The selected alert manager no longer exists or you do not have permission to see it. Please select a different alert
    manager
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
