import React from 'react';

import { Stack } from '@grafana/experimental';
import { Alert, LinkButton } from '@grafana/ui';
import { AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types';

import { GRAFANA_RULES_SOURCE_NAME, isVanillaPrometheusAlertManagerDataSource } from '../../utils/datasource';
import { makeAMLink } from '../../utils/misc';
import { Authorize } from '../Authorize';

import { ReceiversTable } from './ReceiversTable';
import { TemplatesTable } from './TemplatesTable';

interface Props {
  config: AlertManagerCortexConfig;
  alertManagerName: string;
}

export const ReceiversAndTemplatesView = ({ config, alertManagerName }: Props) => {
  const isCloud = alertManagerName !== GRAFANA_RULES_SOURCE_NAME;
  const isVanillaAM = isVanillaPrometheusAlertManagerDataSource(alertManagerName);

  return (
    <Stack direction="column" gap={4}>
      <ReceiversTable config={config} alertManagerName={alertManagerName} />
      {!isVanillaAM && <TemplatesTable config={config} alertManagerName={alertManagerName} />}
      {isCloud && (
        <Authorize actions={[AccessControlAction.AlertingNotificationsExternalWrite]}>
          <Alert severity="info" title="Global config for contact points">
            <p>
              For each external Alertmanager you can define global settings, like server addresses, usernames and
              password, for all the supported contact points.
            </p>
            <LinkButton href={makeAMLink('alerting/notifications/global-config', alertManagerName)} variant="secondary">
              {isVanillaAM ? 'View global config' : 'Edit global config'}
            </LinkButton>
          </Alert>
        </Authorize>
      )}
    </Stack>
  );
};
