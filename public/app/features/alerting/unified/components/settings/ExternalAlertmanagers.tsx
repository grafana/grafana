import React from 'react';

import { Stack } from '@grafana/ui';
import { DATASOURCES_ROUTES } from 'app/features/datasources/constants';
import { AlertmanagerChoice } from 'app/plugins/datasource/alertmanager/types';

import { ExternalAlertmanagerDataSourceWithStatus } from '../../hooks/useExternalAmSelector';
import {
  isAlertmanagerDataSourceInterestedInAlerts,
  isVanillaPrometheusAlertManagerDataSource,
} from '../../utils/datasource';
import { createUrl } from '../../utils/url';

import { AlertmanagerCard } from './AlertmanagerCard';
import { useSettings } from './SettingsContext';

interface Props {
  onEditConfiguration: (dataSourceName: string) => void;
}

export const ExternalAlertmanagers = ({ onEditConfiguration }: Props) => {
  const { externalAlertmanagerDataSourcesWithStatus, configuration, enableAlertmanager, disableAlertmanager } =
    useSettings();

  // determine if the alertmanger is receiving alerts
  // this is true if Grafana is configured to send to either "both" or "external" and the Alertmanager datasource _wants_ to receive alerts.
  const isReceivingGrafanaAlerts = (
    externalDataSourceAlertmanager: ExternalAlertmanagerDataSourceWithStatus
  ): boolean => {
    const sendingToExternal = [AlertmanagerChoice.All, AlertmanagerChoice.External].some(
      (choice) => configuration?.alertmanagersChoice === choice
    );
    const wantsAlertsReceived = isAlertmanagerDataSourceInterestedInAlerts(
      externalDataSourceAlertmanager.dataSourceSettings
    );

    return sendingToExternal && wantsAlertsReceived;
  };

  return (
    <Stack direction="column" gap={0}>
      {externalAlertmanagerDataSourcesWithStatus.map((alertmanager) => {
        const { uid, name, jsonData, url } = alertmanager.dataSourceSettings;
        const { status } = alertmanager;

        const isReceiving = isReceivingGrafanaAlerts(alertmanager);
        const isProvisioned = alertmanager.dataSourceSettings.readOnly === true;
        const isReadOnly =
          isProvisioned || isVanillaPrometheusAlertManagerDataSource(alertmanager.dataSourceSettings.name);
        const detailHref = createUrl(DATASOURCES_ROUTES.Edit.replace(/:uid/gi, uid));

        const handleEditConfiguration = () => onEditConfiguration(name);

        return (
          <AlertmanagerCard
            key={uid}
            name={name}
            href={detailHref}
            url={url}
            provisioned={isProvisioned}
            readOnly={isReadOnly}
            implementation={jsonData.implementation ?? 'Prometheus'}
            receiving={isReceiving}
            status={status}
            onEditConfiguration={handleEditConfiguration}
            onDisable={() => disableAlertmanager(uid)}
            onEnable={() => enableAlertmanager(uid)}
          />
        );
      })}
    </Stack>
  );
};
