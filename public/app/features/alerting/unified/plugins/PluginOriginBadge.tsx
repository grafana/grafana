import { t } from '@grafana/i18n';
import { usePluginSettings } from '@grafana/runtime';
import { Badge, type IconSize, Tooltip } from '@grafana/ui';
import { getSvgSize } from '@grafana/ui/internal';

interface PluginOriginBadgeProps {
  pluginId: string;
  size?: IconSize;
}

export function PluginOriginBadge({ pluginId, size = 'md' }: PluginOriginBadgeProps) {
  const { value: pluginMeta, loading } = usePluginSettings(pluginId);

  if (loading) {
    return null;
  }

  if (!pluginMeta) {
    return null;
  }

  const logo = pluginMeta.info.logos?.small;
  const pluginName = pluginMeta.name;
  const imageSize = getSvgSize(size);

  const badgeIcon = logo ? (
    <img src={logo} alt={pluginName} height={imageSize} />
  ) : (
    <Badge text={pluginId} color="orange" />
  );

  return (
    <Tooltip
      content={t(
        'alerting.plugin-origin-badge.tooltip-managed-by-plugin',
        'This rule is managed by the {{pluginName}} plugin',
        { pluginName }
      )}
    >
      {badgeIcon}
    </Tooltip>
  );
}
