import { css } from '@emotion/css';
import React, { CSSProperties, ReactElement, useRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { useStyles2 } from '../../themes';
import { Icon } from '../Icon/Icon';

import { MenuItemProps } from './MenuItem';
import { useMenuFocus } from './hooks';
import { getPosition } from './utils';

/** @internal */
export interface SubMenuProps {
  /** List of menu items of the subMenu */
  items?: Array<ReactElement<MenuItemProps>>;
  /** Open */
  isOpen: boolean;
  /** Marks whether subMenu was opened with arrow */
  openedWithArrow: boolean;
  /** Changes value of openedWithArrow */
  setOpenedWithArrow: (openedWithArrow: boolean) => void;
  /** Closes the subMenu */
  close: () => void;
  /** Custom style */
  customStyle?: CSSProperties;
}

/** @internal */
export const SubMenu: React.FC<SubMenuProps> = React.memo(
  ({ items, isOpen, openedWithArrow, setOpenedWithArrow, close, customStyle }) => {
    const styles = useStyles2(getStyles);
    const localRef = useRef<HTMLDivElement>(null);
    const [handleKeys] = useMenuFocus({
      localRef,
      isMenuOpen: isOpen,
      openedWithArrow,
      setOpenedWithArrow,
      close,
    });

    return (
      <>
        <div className={styles.iconWrapper} aria-label={selectors.components.Menu.SubMenu.icon}>
          <Icon name="angle-right" className={styles.icon} aria-hidden />
        </div>
        {isOpen && (
          <div
            ref={localRef}
            className={styles.subMenu(localRef.current)}
            aria-label={selectors.components.Menu.SubMenu.container}
            style={customStyle}
          >
            <div tabIndex={-1} className={styles.itemsWrapper} role="menu" onKeyDown={handleKeys}>
              {items}
            </div>
          </div>
        )}
      </>
    );
  }
);

SubMenu.displayName = 'SubMenu';

/** @internal */
const getStyles = (theme: GrafanaTheme2) => {
  return {
    iconWrapper: css`
      display: flex;
      flex: 1;
      justify-content: end;
    `,
    icon: css`
      opacity: 0.7;
      margin-left: ${theme.spacing(2)};
      color: ${theme.colors.text.secondary};
    `,
    itemsWrapper: css`
      background: ${theme.colors.background.primary};
      box-shadow: ${theme.shadows.z3};
      display: inline-block;
      border-radius: ${theme.shape.borderRadius()};
    `,
    subMenu: (element: HTMLElement | null) => css`
      position: absolute;
      top: 0;
      z-index: ${theme.zIndex.dropdown};
      ${getPosition(element)}: 100%;
    `,
  };
};
