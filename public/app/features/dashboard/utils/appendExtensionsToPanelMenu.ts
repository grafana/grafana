import { IconName, PanelMenuItem, PluginExtensionLink } from '@grafana/data';
import { truncateTitle } from 'app/features/plugins/extensions/utils';

const METRICS_DRILLDOWN_CATEGORY = 'metrics-drilldown';
const ROOT_CATEGORY = '${root}';
const EXTENSIONS_CATEGORY = '${root}/Extensions';
const SUBMENU_CATEGORY_PREFIX = `${ROOT_CATEGORY}/`;

type AppendToPanelMenuOpts = {
  rootMenu: PanelMenuItem[];
  extensions: PluginExtensionLink[];
  reservedNames: Set<string>;
  extensionsSubmenuName: string;
};

export function appenExtensionsToPanelMenu(options: AppendToPanelMenuOpts): void {
  const { rootMenu, extensions, reservedNames, extensionsSubmenuName } = options;

  const submenuGroups = groupBySubmenu(extensions, reservedNames, extensionsSubmenuName);
  const groupKeys = Object.keys(submenuGroups).sort();

  for (const key of groupKeys) {
    if (key === ROOT_CATEGORY) {
      const rootCategory = submenuGroups[key];
      if (Array.isArray(rootCategory.subMenu)) {
        rootMenu.push(...rootCategory.subMenu);
      }
      continue;
    }

    if (key === EXTENSIONS_CATEGORY) {
      // Add divider before starting to add ungrouped items to the extensions category
      rootMenu.push({
        // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
        text: 'divider',
        type: 'divider',
      });
    }

    rootMenu.push(submenuGroups[key]);
  }
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

  if (!Array.isArray(bucket[key])) {
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
