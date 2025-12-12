import { Trans, t } from '@grafana/i18n';
import { Button, LinkButton, Menu, Tooltip } from '@grafana/ui';
import { useIrmConfig } from 'app/features/gops/configuration-tracker/irmHooks';

import { usePluginBridge } from '../../hooks/usePluginBridge';
import { createBridgeURL } from '../PluginBridge';

interface Props {
  title?: string;
  severity?: 'minor' | 'major' | 'critical' | '';
  url?: string;
}

export const DeclareIncidentButton = ({ title = '', severity = '', url = '' }: Props) => {
  const {
    irmConfig: { incidentPluginId },
    isIrmConfigLoading,
  } = useIrmConfig();
  const bridgeURL = createBridgeURL(incidentPluginId, '/incidents/declare', {
    title,
    severity,
    url,
  });

  const { loading: isPluginBridgeLoading, installed, settings } = usePluginBridge(incidentPluginId);
  const loading = isIrmConfigLoading || isPluginBridgeLoading;

  return (
    <>
      {loading === true && (
        <Button icon="fire" size="sm" type="button" disabled>
          <Trans i18nKey="alerting.declare-incident-button.declare-incident">Declare Incident</Trans>
        </Button>
      )}
      {installed === false && (
        <Tooltip
          content={t(
            'alerting.declare-incident-button.content-grafana-incident-installed-configured-correctly',
            'Grafana Incident is not installed or is not configured correctly'
          )}
        >
          <Button icon="fire" size="sm" type="button" disabled>
            <Trans i18nKey="alerting.declare-incident-button.declare-incident">Declare Incident</Trans>
          </Button>
        </Tooltip>
      )}
      {settings && (
        <LinkButton icon="fire" size="sm" type="button" href={bridgeURL}>
          <Trans i18nKey="alerting.declare-incident-button.declare-incident">Declare Incident</Trans>
        </LinkButton>
      )}
    </>
  );
};

export const DeclareIncidentMenuItem = ({ title = '', severity = '', url = '' }: Props) => {
  const {
    irmConfig: { incidentPluginId },
    isIrmConfigLoading,
  } = useIrmConfig();
  const bridgeURL = createBridgeURL(incidentPluginId, '/incidents/declare', {
    title,
    severity,
    url,
  });

  const { loading: isPluginBridgeLoading, installed, settings } = usePluginBridge(incidentPluginId);
  const loading = isIrmConfigLoading || isPluginBridgeLoading;

  return (
    <>
      {loading === true && (
        <Menu.Item
          label={t('alerting.declare-incident-menu-item.label-declare-incident', 'Declare incident')}
          icon="fire"
          disabled
        />
      )}
      {installed === false && (
        <Tooltip
          content={t(
            'alerting.declare-incident-menu-item.content-grafana-incident-installed-configured-correctly',
            'Grafana Incident is not installed or is not configured correctly'
          )}
        >
          <Menu.Item
            label={t('alerting.declare-incident-menu-item.label-declare-incident', 'Declare incident')}
            icon="fire"
            disabled
          />
        </Tooltip>
      )}
      {settings && (
        <Menu.Item
          label={t('alerting.declare-incident-menu-item.label-declare-incident', 'Declare incident')}
          url={bridgeURL}
          icon="fire"
        />
      )}
    </>
  );
};
