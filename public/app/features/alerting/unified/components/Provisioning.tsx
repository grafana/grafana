import React from 'react';

import { Alert, Badge } from '@grafana/ui';

interface ProvisioningAlertProps {
  type: string;
}

export const ProvisioningAlert = ({ type }: ProvisioningAlertProps) => {
  return (
    <Alert title={`This ${type} has been provisioned`} severity="info">
      This {type} was added by config and cannot be modified using the UI. Please contact your server admin to update
      this {type}.
    </Alert>
  );
};

export const ProvisioningBadge = () => {
  return <Badge text={'Provisioned'} color={'purple'} />;
};
