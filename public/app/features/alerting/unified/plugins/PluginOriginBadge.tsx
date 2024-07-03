import React from 'react';
import { useAsync } from 'react-use';

import { Badge, Tooltip } from '@grafana/ui';

import { getPluginSettings } from '../../../plugins/pluginSettings';

interface PluginOriginBadgeProps {
  pluginId: string;
}

export function PluginOriginBadge({ pluginId }: PluginOriginBadgeProps) {
  const { value: pluginMeta } = useAsync(() => getPluginSettings(pluginId));

  const logo = pluginMeta?.info.logos?.small;

  const badgeIcon = logo ? (
    <img src={logo} alt={pluginMeta?.name} style={{ width: '20px', height: '20px' }} />
  ) : (
    <Badge text={pluginId} color="orange" />
  );

  const tooltipContent = pluginMeta
    ? `This rule is managed by the ${pluginMeta?.name} plugin`
    : `This rule is managed by a plugin`;

  return (
    <Tooltip content={tooltipContent}>
      <div>{badgeIcon}</div>
    </Tooltip>
  );
}
