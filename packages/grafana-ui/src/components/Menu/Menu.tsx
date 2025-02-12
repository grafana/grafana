import { css, cx } from '@emotion/css';
import { useImperativeHandle, useRef } from 'react';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';
import { Box } from '../Layout/Box/Box';

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

    const [handleKeys] = useMenuFocus({ isMenuOpen: true, localRef, onOpen, onClose, onKeyDown });

    return (
      <Box
        {...otherProps}
        aria-label={ariaLabel}
        backgroundColor="elevated"
        borderRadius="default"
        boxShadow="z3"
        display="inline-block"
        onKeyDown={handleKeys}
        paddingX={0.5}
        paddingY={0.5}
        ref={localRef}
        role="menu"
        tabIndex={-1}
      >
        {header && (
          <div
            className={cx(
              styles.header,
              Boolean(children) && React.Children.toArray(children).length > 0 && styles.headerBorder
            )}
          >
            {header}
          </div>
        )}
        {children}
      </Box>
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
    header: css({
      padding: theme.spacing(0.5, 0.5, 1, 0.5),
    }),
    headerBorder: css({
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      marginBottom: theme.spacing(0.5),
    }),
  };
};
