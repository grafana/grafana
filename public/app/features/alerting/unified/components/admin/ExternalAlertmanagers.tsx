import { capitalize } from 'lodash';
import React from 'react';

import { Badge, Button, Card, Stack, Text, TextLink } from '@grafana/ui';
import { DATASOURCES_ROUTES } from 'app/features/datasources/constants';
import { AlertmanagerChoice } from 'app/plugins/datasource/alertmanager/types';

import { ExternalAlertmanagerDataSourceWithStatus } from '../../hooks/useExternalAmSelector';
import {
  isAlertmanagerDataSourceInterestedInAlerts,
  isVanillaPrometheusAlertManagerDataSource,
} from '../../utils/datasource';
import { createUrl } from '../../utils/url';
import { ProvisioningBadge } from '../Provisioning';
import { WithReturnButton } from '../WithReturnButton';

import { useSettings } from './SettingsContext';

interface Props {
  onEditConfiguration: (dataSourceName: string) => void;
}

export const ExternalAlertmanagers = ({ onEditConfiguration }: Props) => {
  const {
    externalAlertmanagerDataSourcesWithStatus: externalAlertmanagersWithStatus,
    deliverySettings,
    enableAlertmanager,
    disableAlertmanager,
  } = useSettings();

  // determine if the alertmanger is receiving alerts
  // this is true if Grafana is configured to send to either "both" or "external" and the Alertmanager datasource _wants_ to receive alerts.
  const isReceivingOnAlertmanager = (
    externalDataSourceAlertmanager: ExternalAlertmanagerDataSourceWithStatus
  ): boolean => {
    const sendingToExternal = [AlertmanagerChoice.All, AlertmanagerChoice.External].some(
      (choice) => deliverySettings?.alertmanagersChoice === choice
    );
    const wantsAlertsReceived = isAlertmanagerDataSourceInterestedInAlerts(
      externalDataSourceAlertmanager.dataSourceSettings
    );

    return sendingToExternal && wantsAlertsReceived;
  };

  return (
    <Stack direction="column" gap={0}>
      {externalAlertmanagersWithStatus.map((alertmanager) => {
        const { uid, name, jsonData, url } = alertmanager.dataSourceSettings;
        const { status } = alertmanager;

        const isReceiving = isReceivingOnAlertmanager(alertmanager);
        const provisionedDataSource = alertmanager.dataSourceSettings.readOnly === true;
        const detailHref = createUrl(DATASOURCES_ROUTES.Edit.replace(/:uid/gi, uid));
        const readOnlyDataSource =
          provisionedDataSource || isVanillaPrometheusAlertManagerDataSource(alertmanager.dataSourceSettings.name);

        const handleEditConfiguration = () => onEditConfiguration(name);

        return (
          <Card key={uid}>
            <Card.Heading>
              <Stack alignItems="center" gap={1}>
                <WithReturnButton title="Alerting settings" component={<TextLink href={detailHref}>{name}</TextLink>} />
                {provisionedDataSource && <ProvisioningBadge />}
              </Stack>
            </Card.Heading>
            <Card.Figure>
              <img alt="Alertmanager logo" src="public/app/plugins/datasource/alertmanager/img/logo.svg" />
            </Card.Figure>

            <Card.Meta>
              {capitalize(jsonData.implementation ?? 'Prometheus')}
              {url}
            </Card.Meta>

            <Card.Description>
              {!isReceiving ? (
                <Text variant="bodySmall">Not receiving Grafana-managed alerts</Text>
              ) : (
                <>
                  {status === 'pending' && <Badge text="Activation in progress" color="orange" />}
                  {status === 'active' && <Badge text="Receiving Grafana-managed alerts" color="green" />}
                  {status === 'dropped' && <Badge text="Failed to adopt Alertmanager" color="red" />}
                  {status === 'inconclusive' && <Badge text="Inconclusive" color="orange" />}
                </>
              )}
            </Card.Description>

            {/* we'll use the "tags" to append buttons and actions */}
            <Card.Tags>
              <Stack direction="row" gap={1}>
                <Button
                  onClick={handleEditConfiguration}
                  icon={readOnlyDataSource ? 'eye' : 'edit'}
                  variant="secondary"
                  fill="outline"
                >
                  {readOnlyDataSource ? 'View configuration' : 'Edit configuration'}
                </Button>
                {provisionedDataSource ? null : (
                  <>
                    {isReceiving ? (
                      <Button
                        icon="times"
                        variant="destructive"
                        fill="outline"
                        onClick={() => disableAlertmanager(uid)}
                      >
                        Disable
                      </Button>
                    ) : (
                      <Button icon="check" variant="secondary" fill="outline" onClick={() => enableAlertmanager(uid)}>
                        Enable
                      </Button>
                    )}
                  </>
                )}
              </Stack>
            </Card.Tags>
          </Card>
        );
      })}
    </Stack>
  );
};
