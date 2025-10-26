import { ReactElement, useMemo } from 'react';

import { PluginExtensionLink } from '@grafana/data';
import { Menu } from '@grafana/ui';

type Props = {
  extensions: PluginExtensionLink[];
  onSelect: (extension: PluginExtensionLink) => void;
};

export function AlertingRuleExtensionPointMenu({ extensions, onSelect }: Props): ReactElement | null {
  const { categorised, uncategorised } = useExtensionLinksByCategory(extensions);
  const showDivider = uncategorised.length > 0 && Object.keys(categorised).length > 0;

  return (
    <Menu>
      <>
        {Object.keys(categorised).map((category) => (
          <Menu.Group key={category} label={category}>
            {renderItems(categorised[category], onSelect)}
          </Menu.Group>
        ))}
        {showDivider && <Menu.Divider key="divider" />}
        {renderItems(uncategorised, onSelect)}
      </>
    </Menu>
  );
}

function renderItems(extensions: PluginExtensionLink[], onSelect: (link: PluginExtensionLink) => void): JSX.Element[] {
  return extensions.map((extension) => (
    <Menu.Item
      ariaLabel={extension.title}
      icon={extension?.icon || 'plug'}
      key={extension.id}
      label={extension.title}
      onClick={(event) => {
        if (extension.path) {
          return onSelect(extension);
        }
        extension.onClick?.(event);
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
