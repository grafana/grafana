import { css } from '@emotion/css';
import React, { ForwardRefExoticComponent, PropsWithoutRef, RefAttributes, useImperativeHandle, useRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';

import { MenuDivider } from './MenuDivider';
import { MenuItem } from './MenuItem';
import { useMenuFocus } from './hooks';

/** @internal */
export interface MenuProps extends React.HTMLAttributes<HTMLDivElement> {
  /** React element rendered at the top of the menu */
  header?: React.ReactNode;
  children: React.ReactNode;
  ariaLabel?: string;
  onOpen?: (focusOnItem: (itemId: number) => void) => void;
  onClose?: () => void;
  onKeyDown?: React.KeyboardEventHandler;
}

export interface MenuType
  extends ForwardRefExoticComponent<PropsWithoutRef<MenuProps> & RefAttributes<HTMLDivElement>> {
  Item: typeof MenuItem;
  Divider: typeof MenuDivider;
}

/** @internal */
export const Menu: MenuType = React.forwardRef<HTMLDivElement, MenuProps>(
  ({ header, children, ariaLabel, onOpen, onClose, onKeyDown, ...otherProps }, forwardedRef) => {
    const styles = useStyles2(getStyles);

    const localRef = useRef<HTMLDivElement>(null);
    useImperativeHandle(forwardedRef, () => localRef.current!);

    const [handleKeys, handleFocus] = useMenuFocus({ localRef, onOpen, onClose, onKeyDown });

    return (
      <div
        {...otherProps}
        ref={localRef}
        className={styles.wrapper}
        role="menu"
        aria-label={ariaLabel}
        onKeyDown={handleKeys}
        onFocus={handleFocus}
      >
        {header && <div className={styles.header}>{header}</div>}
        {children}
      </div>
    );
  }
) as MenuType;

Menu.Item = MenuItem;
Menu.Divider = MenuDivider;
Menu.displayName = 'Menu';

/** @internal */
const getStyles = (theme: GrafanaTheme2) => {
  return {
    header: css`
      padding: ${theme.spacing(0.5, 0.5, 1, 0.5)};
      border-bottom: 1px solid ${theme.colors.border.weak};
    `,
    wrapper: css`
      background: ${theme.colors.background.primary};
      box-shadow: ${theme.shadows.z3};
      display: inline-block;
      border-radius: ${theme.shape.borderRadius()};
    `,
  };
};
