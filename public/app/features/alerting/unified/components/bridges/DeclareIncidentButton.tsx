import { t } from '@grafana/i18n';
import { Menu, Tooltip } from '@grafana/ui';

import { useIrmPlugin } from '../../hooks/usePluginBridge';
import { SupportedPlugin } from '../../types/pluginBridges';
import { createBridgeURL } from '../PluginBridge';

interface Props {
  title?: string;
  severity?: 'minor' | 'major' | 'critical' | '';
  url?: string;
}

export const DeclareIncidentMenuItem = ({ title = '', severity = '', url = '' }: Props) => {
  const { pluginId, loading, installed, settings } = useIrmPlugin(SupportedPlugin.Incident);

  const bridgeURL = createBridgeURL(pluginId, '/incidents/declare', {
    title,
    severity,
    url,
  });

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
