import { css } from '@emotion/css';
import { type ReactElement, useMemo, type JSX } from 'react';

import { type GrafanaTheme2, type PluginExtensionLink } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Menu, useStyles2 } from '@grafana/ui';
import { truncateTitle } from 'app/features/plugins/extensions/utils';

type Props = {
  extensions: PluginExtensionLink[];
  onSelect: (extension: PluginExtensionLink) => void;
};

export function ToolbarExtensionPointMenu({ extensions, onSelect }: Props): ReactElement | null {
  const styles = useStyles2(getStyles);
  const { categorised, uncategorised } = useExtensionLinksByCategory(extensions);
  const showDivider = uncategorised.length > 0 && Object.keys(categorised).length > 0;

  return (
    <Menu style={{ maxWidth: 'min(260px, calc(100vw - 32px))' }}>
      <>
        {Object.keys(categorised).map((category) => (
          <Menu.Group key={category} label={truncateTitle(category, 25)}>
            {renderItems(categorised[category], onSelect, styles.expandItemLabel)}
          </Menu.Group>
        ))}
        {showDivider && <Menu.Divider key="divider" />}
        {renderItems(uncategorised, onSelect, styles.expandItemLabel)}
      </>
    </Menu>
  );
}

function renderItems(
  extensions: PluginExtensionLink[],
  onSelect: (link: PluginExtensionLink) => void,
  className: string
): JSX.Element[] {
  return extensions.map((extension) => {
    const dataTestId = selectors.pages.Explore.toolbar.add(extension.title);
    return (
      <Menu.Item
        testId={dataTestId}
        ariaLabel={extension.title}
        className={className}
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
    );
  });
}

const getStyles = (theme: GrafanaTheme2) => ({
  expandItemLabel: css({
    '& > div > span': {
      maxHeight: '1.6em',
      [theme.transitions.handleMotion('no-preference')]: {
        transition: 'max-height 180ms ease-out',
      },
    },
    '&:is(:hover, :focus-visible) > div': {
      alignItems: 'flex-start',
    },
    '&:is(:hover, :focus-visible) > div > span': {
      maxHeight: '10em',
      overflowWrap: 'anywhere',
      textAlign: 'start',
      textOverflow: 'clip',
      whiteSpace: 'normal',
    },
  }),
});

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
