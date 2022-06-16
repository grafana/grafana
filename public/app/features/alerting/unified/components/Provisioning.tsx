import React from 'react';

import { Alert, Badge } from '@grafana/ui';

export enum ProvisionedResource {
  ContactPoint = 'contact point',
  Template = 'template',
  MuteTiming = 'mute timing',
  AlertRule = 'alert rule',
  RootNotificationPolicy = 'root notification policy',
}

interface ProvisioningAlertProps {
  resource: ProvisionedResource;
}

export const ProvisioningAlert = ({ resource }: ProvisioningAlertProps) => {
  return (
    <Alert title={`This ${resource} has been provisioned`} severity="info">
      This {resource} has been provisioned and cannot be modified using the UI. Please contact your server admin to
      update this {resource}.
    </Alert>
  );
};

export const ProvisioningBadge = () => {
  return <Badge text={'Provisioned'} color={'purple'} />;
};
