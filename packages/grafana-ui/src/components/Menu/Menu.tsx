import { css } from '@emotion/css';
import React, { useImperativeHandle, useRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';

import { MenuDivider } from './MenuDivider';
import { MenuGroup } from './MenuGroup';
import { MenuItem } from './MenuItem';
import { useMenuFocus } from './hooks';

export interface MenuProps extends React.HTMLAttributes<HTMLDivElement> {
  /** React element rendered at the top of the menu */
  header?: React.ReactNode;
  children: React.ReactNode;
  ariaLabel?: string;
  onOpen?: (focusOnItem: (itemId: number) => void) => void;
  onClose?: () => void;
  onKeyDown?: React.KeyboardEventHandler;
}

const MenuComp = React.forwardRef<HTMLDivElement, MenuProps>(
  ({ header, children, ariaLabel, onOpen, onClose, onKeyDown, ...otherProps }, forwardedRef) => {
    const styles = useStyles2(getStyles);

    const localRef = useRef<HTMLDivElement>(null);
    useImperativeHandle(forwardedRef, () => localRef.current!);

    const [handleKeys, handleFocus] = useMenuFocus({ localRef, onOpen, onClose, onKeyDown });

    return (
      <div
        {...otherProps}
        tabIndex={-1}
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
);

MenuComp.displayName = 'Menu';

export const Menu = Object.assign(MenuComp, {
  Item: MenuItem,
  Divider: MenuDivider,
  Group: MenuGroup,
});

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
      padding: ${theme.spacing(0.5, 0)};
    `,
  };
};
