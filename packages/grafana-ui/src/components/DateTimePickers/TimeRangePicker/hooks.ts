import { RefObject, useEffect, useState } from 'react';

import { TimeOption } from '@grafana/data';

const modulo = (a: number, n: number) => ((a % n) + n) % n;

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
    // Reset focused item when options have changed
    setFocusedItem(0);
    const items = localRef.current?.querySelectorAll<HTMLInputElement>('[data-role="item"]');
    items?.forEach((item, i) => {
      item.tabIndex = i === 0 ? 0 : -1;
    });
  }, [localRef, options]);

  const handleKeys = (event: React.KeyboardEvent) => {
    const items = localRef?.current?.querySelectorAll<HTMLInputElement>('[data-role="item"]');
    const itemsCount = items?.length ?? 0;

    let newFocusedIndex = null;

    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault();
        event.stopPropagation();
        newFocusedIndex = modulo(focusedItem - 1, itemsCount);
        break;
      case 'ArrowDown':
        event.preventDefault();
        event.stopPropagation();
        newFocusedIndex = modulo(focusedItem + 1, itemsCount);
        break;
      case 'Home':
        event.preventDefault();
        event.stopPropagation();
        newFocusedIndex = 0;
        break;
      case 'End':
        event.preventDefault();
        event.stopPropagation();
        newFocusedIndex = itemsCount - 1;
        break;
      case 'Enter':
        event.preventDefault();
        event.stopPropagation();
        items?.[focusedItem]?.click();
        break;
      case 'Tab':
        event.preventDefault();
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
