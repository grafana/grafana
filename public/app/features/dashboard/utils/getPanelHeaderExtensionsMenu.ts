import { PanelMenuItem, PluginExtension, PluginExtensionPoints } from '@grafana/data';
import { getPluginExtensions, isPluginExtensionLink } from '@grafana/runtime';
import { createExtensionPanelContext } from 'app/features/plugins/extensions/contexts';

import { PanelModel, DashboardModel } from '../state';

import { truncateTitle } from './getPanelMenu';

interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
}

export function getPanelHeaderExtensionsMenu({ panel, dashboard }: Props): PanelMenuItem[] {
  const { extensions } = getPluginExtensions({
    extensionPointId: PluginExtensionPoints.DashboardPanelMenu,
    context: createExtensionPanelContext(panel, dashboard),
  });

  const groupExtensionsByPlugin = extensions.reduce<Record<string, PanelMenuItem[]>>((prev, curr) => {
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

  const items = Object.entries(groupExtensionsByPlugin).map<PanelMenuItem>(([pluginName, menuItems]) => ({
    text: pluginName,
    type: 'submenu',
    subMenu: menuItems,
  }));

  return items;
}

function getExtensionMenuItem(extension: PluginExtension): PanelMenuItem | undefined {
  if (isPluginExtensionLink(extension)) {
    return {
      text: truncateTitle(extension.title, 25),
      href: extension.path,
      onClick: extension.onClick,
    };
  }

  return undefined;
}
