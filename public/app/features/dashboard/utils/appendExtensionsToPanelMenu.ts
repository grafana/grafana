import { IconName, PanelMenuItem, PluginExtensionLink } from '@grafana/data';
import { truncateTitle } from 'app/features/plugins/extensions/utils';

const METRICS_DRILLDOWN_CATEGORY = 'metrics-drilldown';
const ROOT_CATEGORY = '${root}';
const EXTENSIONS_CATEGORY = '${root}/Extensions';
const SUBMENU_CATEGORY_PREFIX = `${ROOT_CATEGORY}/`;

export type AppendToPanelMenuOpts = {
  rootMenu: PanelMenuItem[];
  extensions: PluginExtensionLink[];
  reservedNames: Set<string>;
  extensionsSubmenuName: string;
};

export function appenExtensionsToPanelMenu(options: AppendToPanelMenuOpts): void {
  const { rootMenu, extensions, reservedNames, extensionsSubmenuName } = options;

  const submenuGroups = groupBySubmenu(extensions, reservedNames, extensionsSubmenuName);
  const groupKeys = Object.keys(submenuGroups).sort();

  let dividerAdded = false;

  for (const key of groupKeys) {
    if (key === ROOT_CATEGORY) {
      const menuItem = submenuGroups[key];
      if (shouldAppendSubmenu(menuItem)) {
        rootMenu.push(...menuItem.subMenu);
      }
      continue;
    }

    if (key.startsWith(SUBMENU_CATEGORY_PREFIX) && !key.startsWith(EXTENSIONS_CATEGORY)) {
      const menuItem = submenuGroups[key];
      if (shouldAppendSubmenu(menuItem)) {
        rootMenu.push(menuItem);
      }
      continue;
    }

    if (key.startsWith(`${EXTENSIONS_CATEGORY}/`)) {
      const extensionsMenuItem = submenuGroups[EXTENSIONS_CATEGORY];
      const menuItem = submenuGroups[key];

      if (!Array.isArray(extensionsMenuItem.subMenu)) {
        extensionsMenuItem.subMenu = [];
      }

      if (!dividerAdded && shouldAppendSubmenu(extensionsMenuItem)) {
        dividerAdded = true;
        extensionsMenuItem.subMenu.unshift({
          text: '',
          type: 'divider',
        });
      }

      extensionsMenuItem.subMenu.unshift(menuItem);
    }
  }

  const extensionsMenuItem = submenuGroups[EXTENSIONS_CATEGORY];
  if (shouldAppendSubmenu(extensionsMenuItem)) {
    rootMenu.push(extensionsMenuItem);
  }
}

type PanelSubMenuItem = PanelMenuItem & { subMenu: PanelMenuItem[] };

function shouldAppendSubmenu(menuItem: PanelMenuItem | undefined): menuItem is PanelSubMenuItem {
  return !!menuItem && Array.isArray(menuItem.subMenu) && menuItem.subMenu?.length > 0;
}

function groupBySubmenu(
  extensions: PluginExtensionLink[],
  reservedNames: Set<string>,
  extensionsSubmenuName: string
): Record<string, PanelMenuItem> {
  return extensions.reduce<Record<string, PanelMenuItem>>((bucket, extension) => {
    const group = getGroupForExtensionLink(extension);
    const item = extensionLinkToPanelMenuItem(extension);
    const groupName = group?.name.trim();

    // group: ""
    if (!groupName) {
      return appendTo(bucket, {
        item,
        createGroup: createExtensionsGroup(extensionsSubmenuName),
        key: EXTENSIONS_CATEGORY,
      });
    }

    // group: "${ROOT}"
    if (groupName === ROOT_CATEGORY) {
      return appendTo(bucket, {
        item,
        createGroup: createRootGroup,
        key: ROOT_CATEGORY,
      });
    }

    if (groupName?.startsWith(SUBMENU_CATEGORY_PREFIX)) {
      const submenuName = groupName.slice(SUBMENU_CATEGORY_PREFIX.length).trim();
      const truncatedName = truncateTitle(submenuName, 25);

      // group: "${ROOT}/More..."
      if (!truncatedName && reservedNames.has(truncatedName)) {
        return appendTo(bucket, {
          item,
          createGroup: createExtensionsGroup(extensionsSubmenuName),
          key: EXTENSIONS_CATEGORY,
        });
      }

      // group: "${ROOT}/Drilldown"
      return appendTo(bucket, {
        item,
        createGroup: () => ({
          text: truncatedName,
          iconClassName: group?.icon,
          type: 'submenu',
          subMenu: [],
        }),
        key: groupName,
      });
    }

    // group: "Drilldown"
    return appendTo(bucket, {
      item,
      createGroup: () => ({
        text: groupName,
        iconClassName: group?.icon,
        type: 'submenu',
        subMenu: [],
      }),
      key: `${EXTENSIONS_CATEGORY}/${groupName}`,
    });
  }, {});
}

function extensionLinkToPanelMenuItem(extension: PluginExtensionLink): PanelMenuItem {
  return {
    text: truncateTitle(extension.title, 25),
    href: extension.path,
    onClick: extension.onClick,
    iconClassName: extension.icon,
    target: extension.openInNewTab ? '_blank' : undefined,
  };
}

function createExtensionsGroup(extensionsSubmenuName: string): () => PanelMenuItem {
  return () => ({
    text: extensionsSubmenuName,
    iconClassName: 'plug',
    type: 'submenu',
    subMenu: [],
  });
}

function createRootGroup(): PanelMenuItem {
  return {
    text: ROOT_CATEGORY,
    type: 'submenu',
    subMenu: [],
  };
}

type AppendToOpts = {
  createGroup: () => PanelMenuItem;
  key: string;
  item: PanelMenuItem;
};

function appendTo(bucket: Record<string, PanelMenuItem>, options: AppendToOpts): Record<string, PanelMenuItem> {
  const { key, createGroup, item } = options;

  if (!bucket[key]) {
    bucket[key] = createGroup();
  }

  bucket[key].subMenu?.push(item);
  return bucket;
}

function getGroupForExtensionLink(extension: PluginExtensionLink): { name: string; icon?: IconName } | undefined {
  if (extension.group) {
    return extension.group;
  }

  if (extension.category === METRICS_DRILLDOWN_CATEGORY) {
    return {
      name: `${ROOT_CATEGORY}/Metrics drilldown`,
      icon: 'code-branch',
    };
  }

  if (extension.category) {
    return {
      name: extension.category,
    };
  }

  return undefined;
}
