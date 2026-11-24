import { type RefObject, useEffect, useLayoutEffect, useState } from 'react';
import { useEffectOnce } from 'react-use';

const modulo = (a: number, n: number) => ((a % n) + n) % n;
const UNFOCUSED = -1;
const MENU_ITEM_SELECTOR = '[data-role="menuitem"]:not([data-disabled])';

// Menu refs point either to the menu itself or, for submenus, to a floating wrapper around it. Resolve the owned menu
// before collecting items so each focus manager controls only its direct menu. Otherwise, a parent rerender can
// overwrite tab stops managed by an open submenu.
const getMenuItems = (container: HTMLElement | null) => {
  const menu =
    container?.getAttribute('role') === 'menu'
      ? container
      : (container?.querySelector<HTMLElement>('[role="menu"]') ?? container);

  return menu
    ? Array.from(menu.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR)).filter(
        (menuItem) => menu.getAttribute('role') !== 'menu' || menuItem.closest('[role="menu"]') === menu
      )
    : [];
};

/** @internal */
export interface UseMenuFocusProps {
  localRef: RefObject<HTMLElement | null>;
  isMenuOpen?: boolean;
  autoFocus?: boolean;
  close?: () => void;
  onOpen?: (focusOnItem: (itemId: number) => void) => void;
  onClose?: () => void;
  onKeyDown?: React.KeyboardEventHandler;
}

/** @internal */
export type UseMenuFocusReturn = [(event: React.KeyboardEvent) => void];

/** @internal */
export const useMenuFocus = ({
  localRef,
  isMenuOpen,
  autoFocus = true,
  close,
  onOpen,
  onClose,
  onKeyDown,
}: UseMenuFocusProps): UseMenuFocusReturn => {
  const [focusedItem, setFocusedItem] = useState(UNFOCUSED);

  useEffect(() => {
    if (isMenuOpen) {
      setFocusedItem(0);
    }
  }, [isMenuOpen]);

  useEffect(() => {
    const menuItems = getMenuItems(localRef.current);
    if (autoFocus || localRef.current?.contains(document.activeElement)) {
      menuItems[focusedItem]?.focus();
    }
  }, [localRef, focusedItem, autoFocus]);

  // Reconcile replacement items before paint without moving focus on parent updates.
  // DOM children can change without any hook input changing, so this must run after every commit.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const menuItems = getMenuItems(localRef.current);
    const itemCount = menuItems.length;
    const reconciledFocusedItem = focusedItem === UNFOCUSED || focusedItem < itemCount ? focusedItem : itemCount - 1;

    menuItems.forEach((menuItem, i) => {
      menuItem.tabIndex = i === reconciledFocusedItem ? 0 : -1;
    });

    if (reconciledFocusedItem !== focusedItem) {
      setFocusedItem(reconciledFocusedItem);
    }
  });

  useEffectOnce(() => {
    onOpen?.(setFocusedItem);
  });

  const handleKeys = (event: React.KeyboardEvent) => {
    const menuItems = getMenuItems(localRef.current);
    const menuItemsCount = menuItems.length;

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
      case 'ArrowLeft':
        if (close) {
          event.preventDefault();
          event.stopPropagation();
          setFocusedItem(UNFOCUSED);
          close();
        }
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
      case 'Enter':
      case ' ':
        event.preventDefault();
        event.stopPropagation();
        const focusedElement = menuItems[focusedItem];
        const hasSubMenu = Boolean(focusedElement?.querySelector('[data-role="menuitem"]'));

        if (!hasSubMenu) {
          focusedElement?.click();
        }
        break;
      case 'Escape':
        onClose?.();
        break;
      case 'Tab':
        event.preventDefault();
        onClose?.();
        break;
      default:
        break;
    }

    // Forward event to parent
    onKeyDown?.(event);
  };

  return [handleKeys];
};
