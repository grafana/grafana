import { RefObject, useEffect, useState } from 'react';

import { TimeOption } from '@grafana/data';

const modulo = (a: number, n: number) => ((a % n) + n) % n;
const CAUGHT_KEYS = ['ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter', 'Tab'];

/** @internal */
export interface UseListFocusProps {
  localRef: RefObject<HTMLUListElement>;
  options: TimeOption[];
}

/** @internal */
export type UseListFocusReturn = [(event: React.KeyboardEvent) => void];

/** @internal */
export const useListFocus = ({ localRef, options }: UseListFocusProps): UseListFocusReturn => {
  const [focusedItem, setFocusedItem] = useState(0);

  useEffect(() => {
    const items = localRef.current?.querySelectorAll<HTMLInputElement>('[data-role="item"]') || [];
    const checkedIndex = Array.from(items).findIndex((item) => item.checked);
    const newFocusedIndex = checkedIndex >= 0 ? checkedIndex : 0;
    items.forEach((item, i) => {
      item.tabIndex = i === newFocusedIndex ? 0 : -1;
    });
    // Reset focused item when options have changed
    setFocusedItem(newFocusedIndex);
  }, [localRef, options]);

  const handleKeys = (event: React.KeyboardEvent) => {
    const items = localRef?.current?.querySelectorAll<HTMLInputElement>('[data-role="item"]');
    const itemsCount = items?.length ?? 0;

    if (CAUGHT_KEYS.indexOf(event.key) > -1) {
      event.preventDefault();
      if (event.key !== 'Tab') {
        event.stopPropagation();
      }
    }

    let newFocusedIndex = null;

    switch (event.key) {
      case 'ArrowUp':
        newFocusedIndex = modulo(focusedItem - 1, itemsCount);
        break;
      case 'ArrowDown':
        newFocusedIndex = modulo(focusedItem + 1, itemsCount);
        break;
      case 'Home':
        newFocusedIndex = 0;
        break;
      case 'End':
        newFocusedIndex = itemsCount - 1;
        break;
      case 'Enter':
        items?.[focusedItem]?.click();
        break;
      default:
        break;
    }

    if (newFocusedIndex !== null) {
      setFocusedItem(newFocusedIndex);
      items?.[newFocusedIndex]?.focus();
      items?.forEach((item, i) => {
        item.tabIndex = i === newFocusedIndex ? 0 : -1;
      });
    }
  };

  return [handleKeys];
};
