import React from 'react';

import { Stack } from '@grafana/experimental';
import { Alert, LinkButton } from '@grafana/ui';
import { AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';

import { AlertmanagerAction, useAlertmanagerAbility } from '../../hooks/useAbilities';
import { GRAFANA_RULES_SOURCE_NAME, isVanillaPrometheusAlertManagerDataSource } from '../../utils/datasource';
import { makeAMLink } from '../../utils/misc';
import { Authorize } from '../Authorize';

import { ReceiversSection } from './ReceiversSection';
import { ReceiversTable } from './ReceiversTable';
import { TemplatesTable } from './TemplatesTable';

interface Props {
  config: AlertManagerCortexConfig;
  alertManagerName: string;
}

export const ReceiversAndTemplatesView = ({ config, alertManagerName }: Props) => {
  const isGrafanaManagedAlertmanager = alertManagerName === GRAFANA_RULES_SOURCE_NAME;
  const isVanillaAM = isVanillaPrometheusAlertManagerDataSource(alertManagerName);

  return (
    <Stack direction="column" gap={4}>
      <ReceiversTable config={config} alertManagerName={alertManagerName} />
      {/* Vanilla flavored Alertmanager does not support editing message templates via the UI */}
      {!isVanillaAM && <TemplatesView config={config} alertManagerName={alertManagerName} />}
      {/* Grafana manager Alertmanager does not support global config, Mimir and Cortex do */}
      {!isGrafanaManagedAlertmanager && <GlobalConfigAlert alertManagerName={alertManagerName} />}
    </Stack>
  );
};

export const TemplatesView = ({ config, alertManagerName }: Props) => {
  const [createNotificationTemplateSupported, createNotificationTemplateAllowed] = useAlertmanagerAbility(
    AlertmanagerAction.CreateNotificationTemplate
  );

  return (
    <ReceiversSection
      title="Notification templates"
      description="Create notification templates to customize your notifications."
      addButtonLabel="Add template"
      addButtonTo={makeAMLink('/alerting/notifications/templates/new', alertManagerName)}
      showButton={createNotificationTemplateSupported && createNotificationTemplateAllowed}
    >
      <TemplatesTable config={config} alertManagerName={alertManagerName} />
    </ReceiversSection>
  );
};

interface GlobalConfigAlertProps {
  alertManagerName: string;
}

export const GlobalConfigAlert = ({ alertManagerName }: GlobalConfigAlertProps) => {
  const isVanillaAM = isVanillaPrometheusAlertManagerDataSource(alertManagerName);

  return (
    <Authorize actions={[AlertmanagerAction.UpdateExternalConfiguration]}>
      <Alert severity="info" title="Global config for contact points">
        <p>
          For each external Alertmanager you can define global settings, like server addresses, usernames and password,
          for all the supported contact points.
        </p>
        <LinkButton href={makeAMLink('alerting/notifications/global-config', alertManagerName)} variant="secondary">
          {isVanillaAM ? 'View global config' : 'Edit global config'}
        </LinkButton>
      </Alert>
    </Authorize>
  );
};
