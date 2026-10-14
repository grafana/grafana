import { t } from '@grafana/i18n';
import { usePluginSettings } from '@grafana/runtime/unstable';
import { Badge, type IconSize, Tooltip } from '@grafana/ui';
import { getSvgSize } from '@grafana/ui/internal';

interface PluginOriginBadgeProps {
  pluginId: string;
  size?: IconSize;
}

/** Plugin logo (or id badge when it has none) for rules created by a plugin; hidden until settings load. */
export function PluginOriginBadge({ pluginId, size = 'md' }: PluginOriginBadgeProps) {
  const { value: pluginMeta, loading } = usePluginSettings(pluginId);

  if (loading || !pluginMeta) {
    return null;
  }

  const logo = pluginMeta.info.logos?.small;
  const pluginName = pluginMeta.name;

  const badgeIcon = logo ? (
    <img src={logo} alt={pluginName} height={getSvgSize(size)} />
  ) : (
    <Badge text={pluginId} color="orange" />
  );

  return (
    <Tooltip
      content={t(
        'alerting.gma-rule-list.shared.plugin-origin-tooltip',
        'This rule is managed by the {{pluginName}} plugin',
        {
          pluginName,
        }
      )}
    >
      {badgeIcon}
    </Tooltip>
  );
}
