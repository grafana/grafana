import React from 'react';

import { isPluginExtensionCommand, isPluginExtensionLink, PanelMenuItem, PluginExtension } from '@grafana/data';
import { getPluginExtensions } from '@grafana/runtime';
import { GrafanaExtensions } from 'app/features/plugins/extensions/placements';

import { PanelModel, DashboardModel } from '../../state';
import { createExtensionContext, truncateTitle } from '../../utils/getPanelMenu';

import { PanelHeaderMenuNew } from './PanelHeaderMenu';

interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
}

export function PanelHeaderExtensionsMenu({ panel, dashboard }: Props) {
  const { extensions } = getPluginExtensions({
    placement: GrafanaExtensions.DashboardPanelMenu,
    context: createExtensionContext(panel, dashboard),
  });

  const extensionsByPlugin = extensions.reduce<Record<string, PanelMenuItem[]>>((prev, curr) => {
    const pluginName = curr.pluginName;
    const menuItem = getExtensionMenuItem(curr);
    if (menuItem) {
      return {
        ...prev,
        [pluginName]: [...(prev[pluginName] || []), menuItem],
      };
    }
    return prev;
  }, {});

  const items = Object.entries(extensionsByPlugin).map<PanelMenuItem>(([pluginName, menuItems]) => ({
    text: pluginName,
    type: 'submenu',
    subMenu: menuItems,
  }));

  return <PanelHeaderMenuNew items={items} />;
}

function getExtensionMenuItem(extension: PluginExtension): PanelMenuItem | undefined {
  if (isPluginExtensionLink(extension)) {
    return {
      text: truncateTitle(extension.title, 25),
      href: extension.path,
    };
  }

  if (isPluginExtensionCommand(extension)) {
    return {
      text: truncateTitle(extension.title, 25),
      onClick: extension.callHandlerWithContext,
    };
  }

  return undefined;
}
