import { type ReactElement, useMemo, type JSX } from 'react';

import { type PluginExtensionLink } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Menu } from '@grafana/ui';
import { truncateTitle } from 'app/features/plugins/extensions/utils';

// Long enough for "Add to open: <notebook name>" to stay recognisable.
const MAX_TITLE_LENGTH = 40;

type Props = {
  extensions: PluginExtensionLink[];
  onSelect: (extension: PluginExtensionLink) => void;
};

export function ToolbarExtensionPointMenu({ extensions, onSelect }: Props): ReactElement | null {
  const { categorised, uncategorised } = useExtensionLinksByCategory(extensions);
  const showDivider = uncategorised.length > 0 && Object.keys(categorised).length > 0;

  return (
    <Menu>
      <>
        {Object.keys(categorised).map((category) => (
          <Menu.Group key={category} label={truncateTitle(category, 25)}>
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
  return extensions.map((extension) => {
    const dataTestId = selectors.pages.Explore.toolbar.add(extension.title);

    return (
      <Menu.Item
        testId={dataTestId}
        ariaLabel={extension.title}
        icon={extension?.icon || 'plug'}
        key={extension.id}
        label={truncateTitle(extension.title, MAX_TITLE_LENGTH)}
        onClick={(event) => {
          if (extension.path) {
            return onSelect(extension);
          }
          extension.onClick?.(event);
        }}
      />
    );
  });
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
