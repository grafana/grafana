import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '../../themes';
import { useEffectOnce } from 'react-use';

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

const modulo = (a: number, n: number) => ((a % n) + n) % n;
const UNFOCUSED = -1;
type MenuItemElement = HTMLAnchorElement & HTMLButtonElement;

/** @internal */
export const Menu = React.forwardRef<HTMLDivElement, MenuProps>(
  ({ header, children, ariaLabel, onOpen, onClose, onKeyDown, ...otherProps }, forwardedRef) => {
    const styles = useStyles2(getStyles);

    const [focusedItem, setFocusedItem] = useState(UNFOCUSED);

    const localRef = useRef<HTMLDivElement>(null);
    useImperativeHandle(forwardedRef, () => localRef.current!);

    useEffect(() => {
      const menuItems = localRef?.current?.querySelectorAll(`[data-role="menuitem"]`);
      (menuItems?.[focusedItem] as MenuItemElement)?.focus();
      menuItems?.forEach((menuItem, i) => {
        (menuItem as MenuItemElement).tabIndex = i === focusedItem ? 0 : -1;
      });
    }, [localRef, focusedItem]);

    useEffectOnce(() => {
      const firstMenuItem = localRef?.current?.querySelector(`[data-role="menuitem"]`) as MenuItemElement | null;
      if (firstMenuItem) {
        setFocusedItem(0);
      }
      onOpen?.(setFocusedItem);
    });

    const handleKeys = (event: React.KeyboardEvent) => {
      const menuItemsCount = localRef?.current?.querySelectorAll('[data-role="menuitem"]').length ?? 0;

      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault();
          event.stopPropagation();
          setFocusedItem(modulo(focusedItem - 1, menuItemsCount));
          break;
        case 'ArrowDown':
          event.preventDefault();
          event.stopPropagation();
          setFocusedItem(modulo(focusedItem + 1, menuItemsCount));
          break;
        case 'Home':
          event.preventDefault();
          event.stopPropagation();
          setFocusedItem(0);
          break;
        case 'End':
          event.preventDefault();
          event.stopPropagation();
          setFocusedItem(menuItemsCount - 1);
          break;
        case 'Escape':
          event.preventDefault();
          event.stopPropagation();
          onClose?.();
          break;
        case 'Tab':
          onClose?.();
          break;
        default:
          break;
      }

      // Forward event to parent
      onKeyDown?.(event);
    };

    const handleFocus = () => {
      if (focusedItem === UNFOCUSED) {
        setFocusedItem(0);
      }
    };

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
);
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
