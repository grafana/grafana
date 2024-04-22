import React from 'react';
import { useAsync } from 'react-use';

import { Badge } from '@grafana/ui';

import { getPluginSettings } from '../../../plugins/pluginSettings';

interface PluginOriginBadgeProps {
  pluginId: string;
}

export function PluginOriginBadge({ pluginId }: PluginOriginBadgeProps) {
  const { value: pluginMeta } = useAsync(() => getPluginSettings(pluginId));

  const logo = pluginMeta?.info.logos?.small;
  if (!logo) {
    return <Badge text={pluginId} color="orange" />;
  }

  return <img src={logo} alt={pluginMeta?.name} style={{ width: '20px', height: '20px', borderRadius: '50%' }} />;
}
