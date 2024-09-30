import { useAsync } from 'react-use';

import { Badge, IconSize, Tooltip } from '@grafana/ui';
import { getSvgSize } from '@grafana/ui/src/components/Icon/utils';

import { getPluginSettings } from '../../../plugins/pluginSettings';

interface PluginOriginBadgeProps {
  pluginId: string;
  size?: IconSize;
}

export function PluginOriginBadge({ pluginId, size = 'md' }: PluginOriginBadgeProps) {
  const { value: pluginMeta, loading } = useAsync(() => getPluginSettings(pluginId));

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

  return <Tooltip content={`This rule is managed by the ${pluginName} plugin`}>{badgeIcon}</Tooltip>;
}
