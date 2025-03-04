import { css, cx } from '@emotion/css';
import { memo, CSSProperties, ReactElement, useEffect, useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { useStyles2 } from '../../themes';
import { Icon } from '../Icon/Icon';

import { MenuItemProps } from './MenuItem';
import { useMenuFocus } from './hooks';
import { isElementOverflowing } from './utils';

/** @internal */
export interface SubMenuProps {
  /** List of menu items of the subMenu */
  items?: Array<ReactElement<MenuItemProps>>;
  /** Open */
  isOpen: boolean;
  /** Closes the subMenu */
  close: () => void;
  /** Custom style */
  customStyle?: CSSProperties;
}

/** @internal */
export const SubMenu = memo(({ items, isOpen, close, customStyle }: SubMenuProps) => {
  const styles = useStyles2(getStyles);
  const localRef = useRef<HTMLDivElement>(null);
  const [handleKeys] = useMenuFocus({
    localRef,
    isMenuOpen: isOpen,
    close,
  });

  const [pushLeft, setPushLeft] = useState(false);
  useEffect(() => {
    if (isOpen && localRef.current) {
      setPushLeft(isElementOverflowing(localRef.current));
    }
  }, [isOpen]);

  return (
    <>
      <div className={styles.iconWrapper} aria-hidden data-testid={selectors.components.Menu.SubMenu.icon}>
        <Icon name="angle-right" className={styles.icon} />
      </div>
      {isOpen && (
        <div
          ref={localRef}
          className={cx(styles.subMenu, { [styles.pushLeft]: pushLeft })}
          data-testid={selectors.components.Menu.SubMenu.container}
          style={customStyle}
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
    pushLeft: css({
      right: '100%',
      left: 'unset',
    }),
    subMenu: css({
      position: 'absolute',
      top: 0,
      left: '100%',
      zIndex: theme.zIndex.dropdown,
    }),
  };
};
