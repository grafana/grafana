import { css } from '@emotion/css';
import { type CSSProperties, type JSX } from 'react';
import * as React from 'react';

import { type ActionModel, type GrafanaTheme2, type LinkModel } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { useStyles2 } from '../../themes/ThemeContext';
import { linkModelToContextMenuItems } from '../../utils/dataLinks';
import { type OpenMenuTrigger, WithContextMenu } from '../ContextMenu/WithContextMenu';
import { MenuGroup, type MenuItemsGroup } from '../Menu/MenuGroup';
import { MenuItem } from '../Menu/MenuItem';

export interface DataLinksContextMenuProps {
  children: (props: DataLinksContextMenuApi) => JSX.Element;
  links: () => LinkModel[];
  style?: CSSProperties;
  /**
   * @deprecated Will be removed in a future version
   */
  actions?: ActionModel[];
}

/**
 * Props consumers spread on the focusable element that opens the data-links menu.
 * Intentionally `Partial<...>` of the underlying handler types so the props can
 * be applied to either an HTML element (`<button>`) or an SVG element (`<g>`,
 * `<a>`) without TS gymnastics on the consumer side.
 *
 * Use these for the multi-link case to get keyboard accessibility (Enter/Space
 * to open the menu) and the correct ARIA semantics for free.
 */
export interface DataLinksMenuTriggerProps {
  role: 'button';
  tabIndex: 0;
  'aria-haspopup': 'menu';
  onClick: (event: React.MouseEvent<Element>) => void;
  onKeyDown: (event: React.KeyboardEvent<Element>) => void;
}

export interface DataLinksContextMenuApi {
  /**
   * Opens the menu, anchored to either a pointer event, an `Element`, or an
   * explicit `{x, y}`. Most consumers should prefer spreading `triggerProps`
   * onto a focusable element instead of wiring `openMenu` manually.
   */
  openMenu?: (trigger: OpenMenuTrigger) => void;
  targetClassName?: string;
  /**
   * Spread onto the focusable trigger element to make the menu keyboard- and
   * screen-reader-accessible (Enter/Space to open, `role="button"`,
   * `aria-haspopup="menu"`). Only present when the menu has more than one
   * link — for a single link the component renders a real `<a>` itself.
   */
  triggerProps?: DataLinksMenuTriggerProps;
}

export const DataLinksContextMenu = ({ children, links, style }: DataLinksContextMenuProps) => {
  const styles = useStyles2(getStyles);

  const itemsGroup: MenuItemsGroup[] = [
    { items: linkModelToContextMenuItems(links), label: Boolean(links().length) ? 'Data links' : '' },
  ];

  const linksCounter = itemsGroup[0].items.length;
  const renderMenuGroupItems = () => {
    return itemsGroup.map((group, groupIdx) => (
      <MenuGroup key={`${group.label}${groupIdx}`} label={group.label}>
        {(group.items || []).map((item, itemIdx) => (
          <MenuItem
            key={`${group.label}-${groupIdx}-${itemIdx}}`}
            url={item.url}
            label={item.label}
            target={item.target}
            icon={item.icon}
            active={item.active}
            onClick={item.onClick}
            className={styles.itemWrapper}
          />
        ))}
      </MenuGroup>
    ));
  };

  // Class consumers can apply to their click target purely as a visual "this
  // opens a context menu" affordance (cursor only). Behaviour is exposed
  // separately via `openMenu` / `triggerProps`.
  const targetClassName = styles.menuTarget;

  if (linksCounter > 1) {
    return (
      <WithContextMenu renderMenuItems={renderMenuGroupItems}>
        {({ openMenu }) => {
          // Keyboard activation — anchor the menu to the trigger element
          // itself instead of fabricating a synthetic MouseEvent. This works
          // identically for HTML and SVG focusable elements.
          const triggerProps: DataLinksMenuTriggerProps = {
            role: 'button',
            tabIndex: 0,
            'aria-haspopup': 'menu',
            onClick: (e) => openMenu(e),
            onKeyDown: (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openMenu(e.currentTarget);
              }
            },
          };
          return children({ openMenu, targetClassName, triggerProps });
        }}
      </WithContextMenu>
    );
  } else if (linksCounter === 1) {
    const linkModel = links()[0];
    return (
      <a
        href={linkModel.href}
        onClick={linkModel.onClick}
        target={linkModel.target}
        title={linkModel.title}
        // Layout shorthands stay inline for back-compat — BarGauge/Gauge pass
        // `style={{ flexGrow: 1 }}`/`{ height: '100%' }` and rely on the
        // wrapper being a flex container. The `:focus-visible` ring lives in
        // the themed class so every consumer gains a focus indicator without
        // opting in (this is what fixes the keyboard-accessibility gap).
        style={{ ...style, overflow: 'hidden', display: 'flex' }}
        className={styles.singleLink}
        data-testid={selectors.components.DataLinksContextMenu.singleLink}
      >
        {children({})}
      </a>
    );
  }

  // No links — render children plainly. This guards a long-standing latent
  // crash: `hasLinks` and a `getLinks` supplier come from independent code
  // paths (`hasLinks(field)` checks `field.config.links.length` while the
  // supplier is created by `applyFieldOverrides`), so consumers can land here
  // with `getLinks() === []`. Returning `children({})` mirrors what the panel
  // would have rendered without the wrapper.
  return children({});
};

const getStyles = (theme: GrafanaTheme2) => ({
  itemWrapper: css({
    fontSize: 12,
  }),
  // The single-link path used to ship only inline styles; the `:focus-visible`
  // ring is the one piece of polish that was missing and the reason panels
  // were re-implementing this branch themselves. Layout shorthands stay
  // inline (see component) so this class is purely visual.
  singleLink: css({
    color: 'inherit',
    textDecoration: 'none',
    borderRadius: theme.shape.radius.default,
    '&:focus-visible': {
      outline: `2px solid ${theme.colors.primary.main}`,
      outlineOffset: '2px',
    },
  }),
  menuTarget: css({
    cursor: 'context-menu',
    borderRadius: theme.shape.radius.default,
    '&:focus-visible': {
      outline: `2px solid ${theme.colors.primary.main}`,
      outlineOffset: '2px',
    },
  }),
});
