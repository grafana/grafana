import { ComponentPropsWithoutRef } from 'react';

import { Alert, Badge, Tooltip } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

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
    <Alert
      title={t('alerting.provisioning.title-provisioned', 'This {{resource}} cannot be edited through the UI', {
        resource,
      })}
      severity="info"
      {...rest}
    >
      <Trans i18nKey="alerting.provisioning.body-provisioned">
        This {{ resource }} has been provisioned, that means it was created by config. Please contact your server admin
        to update this {{ resource }}.
      </Trans>
    </Alert>
  );
};

export const ProvisioningBadge = ({
  tooltip,
  provenance,
}: {
  tooltip?: boolean;
  /**
   * If provided, will be used within any displayed tooltip to indicate the type of provisioning
   */
  provenance?: string;
}) => {
  const badge = <Badge text={t('alerting.provisioning-badge.badge.text-provisioned', 'Provisioned')} color="purple" />;

  if (tooltip) {
    const provenanceTooltip = (
      <Trans i18nKey="alerting.provisioning.badge-tooltip-provenance" values={{ provenance }}>
        This resource has been provisioned via {{ provenance }} and cannot be edited through the UI
      </Trans>
    );

    const standardTooltip = (
      <Trans i18nKey="alerting.provisioning.badge-tooltip-standard">
        This resource has been provisioned and cannot be edited through the UI
      </Trans>
    );

    const tooltipContent = provenance ? provenanceTooltip : standardTooltip;
    return (
      <Tooltip content={tooltipContent}>
        <span>{badge}</span>
      </Tooltip>
    );
  }
  return badge;
};
