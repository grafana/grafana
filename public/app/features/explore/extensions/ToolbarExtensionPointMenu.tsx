import React, { ReactElement, useMemo } from 'react';

import { PluginExtensionComponent, PluginExtensionLink } from '@grafana/data';
import { Menu } from '@grafana/ui';
import { truncateTitle } from 'app/features/plugins/extensions/utils';

type Props = {
  extensions: PluginExtensionLink[];
  extensionComponents: PluginExtensionComponent[];
  onSelect: (extension: PluginExtensionLink) => void;
  onComponentSelect: (extension: PluginExtensionComponent) => void;
};

export function ToolbarExtensionPointMenu({
  extensions,
  extensionComponents,
  onSelect,
  onComponentSelect,
}: Props): ReactElement | null {
  const { categorised, uncategorised } = useExtensionLinksByCategory(extensions);
  const showDivider = uncategorised.length > 0 && Object.keys(categorised).length > 0;
  const showComponents = extensionComponents.length > 0;

  return (
    <Menu>
      <>
        {Object.keys(categorised).map((category) => (
          <Menu.Group key={category} label={truncateTitle(category, 25)}>
            {renderLinkItems(categorised[category], onSelect)}
          </Menu.Group>
        ))}
        {showDivider && <Menu.Divider key="divider" />}
        {renderLinkItems(uncategorised, onSelect)}
        {showComponents && <Menu.Divider key="divider" />}
        {renderComponentItems(extensionComponents, onComponentSelect)}
      </>
    </Menu>
  );
}

function renderLinkItems(
  extensions: PluginExtensionLink[],
  onSelect: (link: PluginExtensionLink) => void
): JSX.Element[] {
  return extensions.map((extension) => (
    <Menu.Item
      ariaLabel={extension.title}
      icon={extension?.icon || 'plug'}
      key={extension.id}
      label={truncateTitle(extension.title, 25)}
      onClick={(event) => {
        if (extension.path) {
          return onSelect(extension);
        }
        extension.onClick?.(event);
      }}
    />
  ));
}

function renderComponentItems(
  extensions: PluginExtensionComponent[],
  onComponentSelect: (link: PluginExtensionComponent) => void
): JSX.Element[] {
  return extensions.map((extension) => (
    <Menu.Item
      ariaLabel={extension.title}
      icon={'plug'}
      key={extension.id}
      label={truncateTitle(extension.title, 25)}
      onClick={(event) => {
        onComponentSelect(extension);
      }}
    />
  ));
}

type ExtensionLinksResult = {
  uncategorised: PluginExtensionLink[];
  categorised: Record<string, PluginExtensionLink[]>;
};

function useExtensionLinksByCategory(extensions: PluginExtensionLink[]): ExtensionLinksResult {
  return useMemo(() => {
    const uncategorised: PluginExtensionLink[] = [];
    const categorised: Record<string, PluginExtensionLink[]> = {};

    for (const link of extensions) {
      if (!link.category) {
        uncategorised.push(link);
        continue;
      }

      if (!Array.isArray(categorised[link.category])) {
        categorised[link.category] = [];
      }
      categorised[link.category].push(link);
      continue;
    }

    return {
      uncategorised,
      categorised,
    };
  }, [extensions]);
}
