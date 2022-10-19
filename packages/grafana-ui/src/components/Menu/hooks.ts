import { RefObject, useEffect, useState } from 'react';
import { useEffectOnce } from 'react-use';

const modulo = (a: number, n: number) => ((a % n) + n) % n;
const UNFOCUSED = -1;

/** @internal */
export interface UseMenuFocusProps {
  localRef: RefObject<HTMLDivElement>;
  isMenuOpen?: boolean;
  openedWithArrow?: boolean;
  setOpenedWithArrow?: (openedWithArrow: boolean) => void;
  close?: () => void;
  onOpen?: (focusOnItem: (itemId: number) => void) => void;
  onClose?: () => void;
  onKeyDown?: React.KeyboardEventHandler;
}

/** @internal */
export type UseMenuFocusReturn = [(event: React.KeyboardEvent) => void, () => void];

/** @internal */
export const useMenuFocus = ({
  localRef,
  isMenuOpen,
  openedWithArrow,
  setOpenedWithArrow,
  close,
  onOpen,
  onClose,
  onKeyDown,
}: UseMenuFocusProps): UseMenuFocusReturn => {
  const [focusedItem, setFocusedItem] = useState(UNFOCUSED);

  useEffect(() => {
    if (isMenuOpen && openedWithArrow) {
      setFocusedItem(0);
      setOpenedWithArrow?.(false);
    }
  }, [isMenuOpen, openedWithArrow, setOpenedWithArrow]);

  useEffect(() => {
    const menuItems = localRef?.current?.querySelectorAll<HTMLElement | HTMLButtonElement | HTMLAnchorElement>(
      `[data-role="menuitem"]`
    );
    menuItems?.[focusedItem]?.focus();
    menuItems?.forEach((menuItem, i) => {
      menuItem.tabIndex = i === focusedItem ? 0 : -1;
    });
  }, [localRef, focusedItem]);

  useEffectOnce(() => {
    const firstMenuItem = localRef?.current?.querySelector<HTMLElement | HTMLButtonElement | HTMLAnchorElement>(
      `[data-role="menuitem"]`
    );
    if (firstMenuItem) {
      firstMenuItem.tabIndex = 0;
    }
    onOpen?.(setFocusedItem);
  });

  const handleKeys = (event: React.KeyboardEvent) => {
    const menuItems = localRef?.current?.querySelectorAll<HTMLElement | HTMLButtonElement | HTMLAnchorElement>(
      `[data-role="menuitem"]`
    );
    const menuItemsCount = menuItems?.length ?? 0;

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
        event.preventDefault();
        event.stopPropagation();
        setFocusedItem(UNFOCUSED);
        close?.();
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
        event.preventDefault();
        event.stopPropagation();
        menuItems?.[focusedItem]?.click();
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

  return [handleKeys, handleFocus];
};
