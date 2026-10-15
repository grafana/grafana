import { t } from '@grafana/i18n';
import { usePluginSettings } from '@grafana/runtime/unstable';
import { Badge, type IconSize, Tooltip } from '@grafana/ui';
import { getSvgSize } from '@grafana/ui/internal';

interface PluginOriginBadgeProps {
  pluginId: string;
  size?: IconSize;
}

/** Falls back to the plugin id while settings load or fail, so the plugin-managed marker never disappears. */
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
