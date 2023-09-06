import React from 'react';

import { PluginType } from '@grafana/data';
import { HorizontalGroup, PluginSignatureBadge } from '@grafana/ui';

import { CatalogPlugin } from '../types';

import {
  PluginEnterpriseBadge,
  PluginDisabledBadge,
  PluginInstalledBadge,
  PluginUpdateAvailableBadge,
  PluginAngularBadge,
} from './Badges';

type PluginBadgeType = {
  plugin: CatalogPlugin;
};

export function PluginListItemBadges({ plugin }: PluginBadgeType) {
  // Currently renderer plugins are not supported by the catalog due to complications related to installation / update / uninstall.
  const hasUpdate = plugin.hasUpdate && !plugin.isCore && plugin.type !== PluginType.renderer;
  if (plugin.isEnterprise) {
    return (
      <HorizontalGroup height="auto" wrap>
        <PluginEnterpriseBadge plugin={plugin} />
        {plugin.isDisabled && <PluginDisabledBadge error={plugin.error} />}
        {hasUpdate && <PluginUpdateAvailableBadge plugin={plugin} />}
        {plugin.angularDetected && <PluginAngularBadge />}
      </HorizontalGroup>
    );
  }

  return (
    <HorizontalGroup height="auto" wrap>
      <PluginSignatureBadge status={plugin.signature} />
      {plugin.isDisabled && <PluginDisabledBadge error={plugin.error} />}
      {plugin.isInstalled && <PluginInstalledBadge />}
      {hasUpdate && <PluginUpdateAvailableBadge plugin={plugin} />}
      {plugin.angularDetected && <PluginAngularBadge />}
    </HorizontalGroup>
  );
}
