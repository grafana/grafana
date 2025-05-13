import { Button, LinkButton, Menu, Tooltip } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import { usePluginBridge } from '../../hooks/usePluginBridge';
import { getIrmIfPresentOrIncidentPluginId } from '../../utils/config';
import { createBridgeURL } from '../PluginBridge';

interface Props {
  title?: string;
  severity?: 'minor' | 'major' | 'critical' | '';
  url?: string;
}

const pluginId = getIrmIfPresentOrIncidentPluginId();

export const DeclareIncidentButton = ({ title = '', severity = '', url = '' }: Props) => {
  const bridgeURL = createBridgeURL(pluginId, '/incidents/declare', {
    title,
    severity,
    url,
  });

  const { loading, installed, settings } = usePluginBridge(pluginId);

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
  const bridgeURL = createBridgeURL(pluginId, '/incidents/declare', {
    title,
    severity,
    url,
  });

  const { loading, installed, settings } = usePluginBridge(pluginId);

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
