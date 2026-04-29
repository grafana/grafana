import { t } from '@grafana/i18n';
import { Menu, Tooltip } from '@grafana/ui';

import { canAccessPluginPage, useIrmPlugin } from '../../hooks/usePluginBridge';
import { SupportedPlugin } from '../../types/pluginBridges';
import { createBridgeURL } from '../PluginBridge';

interface Props {
  title?: string;
  severity?: 'minor' | 'major' | 'critical' | '';
  url?: string;
}

export const DeclareIncidentMenuItem = ({ title = '', severity = '', url = '' }: Props) => {
  const { pluginId, loading, installed, settings } = useIrmPlugin(SupportedPlugin.Incident);
  const incidentPath = '/incidents/declare';

  const bridgeURL = createBridgeURL(pluginId, incidentPath, {
    title,
    severity,
    url,
  });
  const hasAccess = settings ? canAccessPluginPage(settings, createBridgeURL(pluginId, incidentPath)) : false;

  return (
    <>
      {loading && (
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
      {settings && !hasAccess && (
        <Tooltip
          content={t(
            'alerting.declare-incident-menu-item.content-you-do-not-have-permission-to-access-incident',
            'You do not have permission to access Incident'
          )}
        >
          <Menu.Item
            label={t('alerting.declare-incident-menu-item.label-declare-incident', 'Declare incident')}
            icon="fire"
            disabled
          />
        </Tooltip>
      )}
      {settings && hasAccess && (
        <Menu.Item
          label={t('alerting.declare-incident-menu-item.label-declare-incident', 'Declare incident')}
          url={bridgeURL}
          icon="fire"
        />
      )}
    </>
  );
};
