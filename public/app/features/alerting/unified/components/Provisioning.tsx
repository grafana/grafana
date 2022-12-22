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
    <Alert title={`This ${resource} cannot be edited through the UI`} severity="info">
      This {resource} has been provisioned, that means it was created by config. Please contact your server admin to
      update this {resource}.
    </Alert>
  );
};

export const ProvisioningBadge = () => {
  return <Badge text={'Provisioned'} color={'purple'} />;
};
