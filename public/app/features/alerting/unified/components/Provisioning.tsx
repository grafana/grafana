import { ComponentPropsWithoutRef } from 'react';

import { Alert, Badge, Tooltip } from '@grafana/ui';

export enum ProvisionedResource {
  ContactPoint = 'contact point',
  Template = 'template',
  MuteTiming = 'mute timing',
  AlertRule = 'alert rule',
  RootNotificationPolicy = 'root notification policy',
}

// we'll omit the props we don't want consumers to overwrite and forward the others to the alert component
type ExtraAlertProps = Omit<ComponentPropsWithoutRef<typeof Alert>, 'title' | 'severity'>;

interface ProvisioningAlertProps extends ExtraAlertProps {
  resource: ProvisionedResource;
}

export const ProvisioningAlert = ({ resource, ...rest }: ProvisioningAlertProps) => {
  return (
    <Alert title={`This ${resource} cannot be edited through the UI`} severity="info" {...rest}>
      This {resource} has been provisioned, that means it was created by config. Please contact your server admin to
      update this {resource}.
    </Alert>
  );
};

export const ProvisioningBadge = ({ tooltip }: { tooltip?: boolean }) => {
  const badge = <Badge text={'Provisioned'} color={'purple'} />;

  if (tooltip) {
    return (
      <Tooltip content={'This resource has been provisioned and cannot be edited through the UI'}>
        <span>{badge}</span>
      </Tooltip>
    );
  }
  return badge;
};
