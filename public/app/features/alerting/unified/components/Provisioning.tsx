import { ComponentPropsWithoutRef } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Alert, Badge, Tooltip } from '@grafana/ui';

import { KnownProvenance } from '../types/knownProvenance';

export enum ProvisionedResource {
  ContactPoint = 'contact point',
  Template = 'template',
  MuteTiming = 'time interval',
  AlertRule = 'alert rule',
  RootNotificationPolicy = 'root notification policy',
  AlertEnrichment = 'alert enrichment',
}

// we'll omit the props we don't want consumers to overwrite and forward the others to the alert component
type ExtraAlertProps = Omit<ComponentPropsWithoutRef<typeof Alert>, 'title' | 'severity'>;

interface ResourceAlertProps extends ExtraAlertProps {
  resource: ProvisionedResource;
  /** When true, renders a compact header-only alert with the description in a tooltip */
  compact?: boolean;
}

export const ProvisioningAlert = ({ resource, compact, ...rest }: ResourceAlertProps) => {
  const title = t('alerting.provisioning.title-provisioned', 'This {{resource}} cannot be edited through the UI', {
    resource,
  });
  const body = t(
    'alerting.provisioning.body-provisioned',
    'This {{resource}} has been provisioned, that means it was created by config. Please contact your server admin to update this {{resource}}.',
    { resource }
  );

  if (compact) {
    const compactTitle = t('alerting.provisioning.title-provisioned-compact', 'Provisioned {{resource}}', {
      resource,
    });
    return (
      <Tooltip content={body}>
        <div>
          <Alert title={compactTitle} severity="info" bottomSpacing={0} topSpacing={0} />
        </div>
      </Tooltip>
    );
  }

  return (
    <Alert title={title} severity="info" {...rest}>
      {body}
    </Alert>
  );
};

export const ImportedResourceAlert = ({ resource, ...rest }: ResourceAlertProps) => {
  return (
    <Alert
      title={t(
        'alerting.provisioning.title-imported',
        'This {{resource}} was imported and cannot be edited through the UI',
        {
          resource,
        }
      )}
      severity="info"
      {...rest}
    >
      <Trans i18nKey="alerting.provisioning.body-imported">
        This {{ resource }} contains integrations that were imported from an external Alertmanager and is currently
        read-only. The integrations will become editable after the migration process is complete.
      </Trans>
    </Alert>
  );
};

export const ImportedTimeIntervalAlert = (props: ExtraAlertProps) => {
  return (
    <Alert
      title={t(
        'alerting.provisioning.title-imported-time-interval',
        'This time interval was imported and cannot be edited through the UI'
      )}
      severity="info"
      {...props}
    >
      <Trans i18nKey="alerting.provisioning.body-imported-time-interval">
        This time interval was imported from an external Alertmanager and is currently read-only. The time interval will
        become editable after the migration process is complete.
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
  const isConvertedPrometheus = provenance === KnownProvenance.ConvertedPrometheus;
  const badgeText = isConvertedPrometheus
    ? t('alerting.provisioning-badge.badge.text-converted-prometheus', 'Imported')
    : t('alerting.provisioning-badge.badge.text-provisioned', 'Provisioned');
  const badgeColor = isConvertedPrometheus ? 'blue' : 'purple';
  const badge = <Badge text={badgeText} color={badgeColor} />;

  if (tooltip) {
    const provenanceText = isConvertedPrometheus ? 'Prometheus/Mimir' : provenance;
    const provenanceTooltip = (
      <Trans i18nKey="alerting.provisioning.badge-tooltip-provenance" values={{ provenance: provenanceText }}>
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
