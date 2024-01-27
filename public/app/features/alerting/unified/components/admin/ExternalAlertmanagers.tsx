import { capitalize } from 'lodash';
import React from 'react';

import { Badge, Button, Card, Stack, Text, TextLink } from '@grafana/ui';
import { useDataSourcesRoutes } from 'app/features/datasources/state';
import { AlertmanagerChoice } from 'app/plugins/datasource/alertmanager/types';

import { ExternalAlertmanagerDataSourceWithStatus } from '../../hooks/useExternalAmSelector';
import { isAlertmanagerDataSourceInterestedInAlerts } from '../../utils/datasource';
import { createUrl } from '../../utils/url';
import { ProvisioningBadge } from '../Provisioning';

import { useSettings } from './SettingsContext';

interface Props {
  onEditConfiguration: () => void;
}

export const ExternalAlertmanagers = ({ onEditConfiguration }: Props) => {
  const { externalAlertmanagers, deliverySettings, enableAlertmanager, disableAlertmanager } = useSettings();

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
    <>
      {externalAlertmanagers.map((alertmanager) => {
        const { uid, name, jsonData, url } = alertmanager.dataSourceSettings;
        const { status } = alertmanager;

        const isReceiving = isReceivingOnAlertmanager(alertmanager);
        const dataSourceHref = useDataSourceEditLink(uid);
        const provisionedDataSource = alertmanager.dataSourceSettings.readOnly === true;

        return (
          <Card key={uid}>
            <Card.Heading>
              <Stack alignItems="center" gap={1}>
                <TextLink href={dataSourceHref}>{name}</TextLink>
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
                <Button onClick={onEditConfiguration} icon="pen" variant="secondary" fill="outline">
                  Edit configuration
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
    </>
  );
};

// I copied this from the datasources list page – maybe we should make this DRY? :)
function useDataSourceEditLink(uid: string) {
  const dataSourcesRoutes = useDataSourcesRoutes();
  const dsLink = createUrl(dataSourcesRoutes.Edit.replace(/:uid/gi, uid));

  return dsLink;
}
