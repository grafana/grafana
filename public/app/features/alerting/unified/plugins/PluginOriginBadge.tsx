import React from 'react';

import { Badge } from '@grafana/ui';
import { pluginsApi } from 'app/features/plugins/pluginsApi';

interface PluginOriginBadgeProps {
  pluginId: string;
}

export function PluginOriginBadge({ pluginId }: PluginOriginBadgeProps) {
  const { data: pluginMeta } = pluginsApi.endpoints.getSettigns.useQuery({ pluginId });

  const logo = pluginMeta?.info.logos?.small;
  if (!logo) {
    return <Badge text={pluginId} color="orange" />;
  }

  return <img src={logo} alt={pluginMeta?.name} style={{ width: '20px', height: '20px', borderRadius: '50%' }} />;
}
