import React from 'react';
import { HorizontalGroup, PluginSignatureBadge } from '@grafana/ui';
import { CatalogPlugin } from '../types';
import { PluginEnterpriseBadge, PluginErrorBadge, PluginInstalledBadge } from './Badges';

type PluginBadgeType = {
  plugin: CatalogPlugin;
};

export function PluginListBadges({ plugin }: PluginBadgeType) {
  if (plugin.isEnterprise) {
    return (
      <HorizontalGroup>
        <PluginEnterpriseBadge plugin={plugin} />
        {plugin.error && <PluginErrorBadge error={plugin.error} />}
      </HorizontalGroup>
    );
  }

  return (
    <HorizontalGroup>
      <PluginSignatureBadge status={plugin.signature} />
      {plugin.isInstalled && <PluginInstalledBadge />}
      {plugin.error && <PluginErrorBadge error={plugin.error} />}
    </HorizontalGroup>
  );
}
