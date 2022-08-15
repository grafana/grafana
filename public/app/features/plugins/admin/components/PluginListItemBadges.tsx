import React from 'react';

import { HorizontalGroup, PluginSignatureBadge } from '@grafana/ui';

import { CatalogPlugin } from '../../types';

import { PluginEnterpriseBadge, PluginDisabledBadge, PluginInstalledBadge, PluginUpdateAvailableBadge } from './Badges';

type PluginBadgeType = {
  plugin: CatalogPlugin;
};

export function PluginListItemBadges({ plugin }: PluginBadgeType) {
  if (plugin.info.isEnterprise) {
    return (
      <HorizontalGroup height="auto" wrap>
        <PluginEnterpriseBadge plugin={plugin} />
        {plugin.settings.isDisabled && <PluginDisabledBadge error={plugin.error} />}
        <PluginUpdateAvailableBadge plugin={plugin} />
      </HorizontalGroup>
    );
  }

  return (
    <HorizontalGroup height="auto" wrap>
      <PluginSignatureBadge status={plugin.info.signature} />
      {plugin.settings.isDisabled && <PluginDisabledBadge error={plugin.error} />}
      {plugin.settings.isInstalled && <PluginInstalledBadge />}
      <PluginUpdateAvailableBadge plugin={plugin} />
    </HorizontalGroup>
  );
}
