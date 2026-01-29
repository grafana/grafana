import { css } from '@emotion/css';
import { autoUpdate, useFloating } from '@floating-ui/react';
import { memo, CSSProperties, ReactElement } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { useStyles2 } from '../../themes/ThemeContext';
import { getPositioningMiddleware } from '../../utils/floating';
import { Icon } from '../Icon/Icon';

import { MenuItemProps } from './MenuItem';
import { useMenuFocus } from './hooks';

/** @internal */
export interface SubMenuProps {
  parentItemRef: React.RefObject<HTMLElement>;
  /** List of menu items of the subMenu */
  items?: Array<ReactElement<MenuItemProps>>;
  /** Open */
  isOpen: boolean;
  /** Closes the subMenu */
  close: () => void;
  /** Custom style */
  customStyle?: CSSProperties;
}

const SUBMENU_POSITION = 'right-start';

/** @internal */
export const SubMenu = memo(({ parentItemRef, items, isOpen, close, customStyle }: SubMenuProps) => {
  const styles = useStyles2(getStyles);
  // the order of middleware is important!
  const middleware = [...getPositioningMiddleware(SUBMENU_POSITION)];

  const { refs, floatingStyles } = useFloating({
    open: isOpen,
    placement: SUBMENU_POSITION,
    middleware,
    whileElementsMounted: autoUpdate,
    elements: {
      reference: parentItemRef.current,
    },
  });

  const [handleKeys] = useMenuFocus({
    localRef: refs.floating,
    isMenuOpen: isOpen,
    close,
  });

  return (
    <>
      <div className={styles.iconWrapper} aria-hidden data-testid={selectors.components.Menu.SubMenu.icon}>
        <Icon name="angle-right" className={styles.icon} />
      </div>
      {isOpen && (
        <div
          ref={refs.setFloating}
          className={styles.subMenu}
          data-testid={selectors.components.Menu.SubMenu.container}
          style={{
            ...floatingStyles,
            ...customStyle,
          }}
        >
          <div tabIndex={-1} className={styles.itemsWrapper} role="menu" onKeyDown={handleKeys}>
            {items}
          </div>
        </div>
      )}
    </>
  );
});

SubMenu.displayName = 'SubMenu';

/** @internal */
const getStyles = (theme: GrafanaTheme2) => {
  return {
    iconWrapper: css({
      display: 'flex',
      flex: 1,
      justifyContent: 'end',
    }),
    icon: css({
      opacity: 0.7,
      marginLeft: theme.spacing(1),
      color: theme.colors.text.secondary,
    }),
    itemsWrapper: css({
      background: theme.colors.background.elevated,
      padding: theme.spacing(0.5),
      boxShadow: theme.shadows.z3,
      display: 'inline-block',
      borderRadius: theme.shape.radius.default,
    }),
    subMenu: css({
      zIndex: theme.zIndex.dropdown,
    }),
  };
};
