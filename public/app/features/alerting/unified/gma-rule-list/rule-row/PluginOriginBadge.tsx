import { t } from '@grafana/i18n';
import { usePluginSettings } from '@grafana/runtime/unstable';
import { Badge, type IconSize, Tooltip } from '@grafana/ui';
import { getSvgSize } from '@grafana/ui/internal';

interface PluginOriginBadgeProps {
  pluginId: string;
  size?: IconSize;
}

/**
 * Plugin logo for rules created by a plugin. While the plugin settings load, or when they are
 * missing or fail, the badge falls back to the plugin id: the origin label already proves the
 * rule is plugin-managed, so the marker must not disappear.
 */
export function PluginOriginBadge({ pluginId, size = 'md' }: PluginOriginBadgeProps) {
  const { value: pluginMeta, loading } = usePluginSettings(pluginId);

  const logo = loading ? undefined : pluginMeta?.info.logos?.small;
  const pluginName = loading ? pluginId : (pluginMeta?.name ?? pluginId);
  const tooltip = t(
    'alerting.gma-rule-list.shared.plugin-origin-tooltip',
    'This rule is managed by the {{pluginName}} plugin',
    { pluginName }
  );

  if (!logo) {
    return <Badge text={pluginId} color="orange" icon="plug" tooltip={tooltip} />;
  }

  return (
    <Tooltip content={tooltip}>
      <img src={logo} alt={pluginName} height={getSvgSize(size)} />
    </Tooltip>
  );
}
