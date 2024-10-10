import { autoUpdate, flip, size, useFloating } from '@floating-ui/react';
import { useMemo, useRef, useState } from 'react';

import { measureText } from '../../utils';

import { ComboboxOption } from './Combobox';
import { MENU_ITEM_FONT_SIZE, MENU_ITEM_FONT_WEIGHT, MENU_ITEM_PADDING_X } from './getComboboxStyles';

// Only consider the first n items when calculating the width of the popover.
const WIDTH_CALCULATION_LIMIT_ITEMS = 100_000;

/**
 * Used with Downshift to get the height of each item
 */
export function estimateSize() {
  return 45;
}

export const useComboboxFloat = (
  items: Array<ComboboxOption<string | number>>,
  range: { startIndex: number; endIndex: number } | null,
  isOpen: boolean
) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const floatingRef = useRef<HTMLDivElement>(null);
  const [popoverMaxWidth, setPopoverMaxWidth] = useState<number | undefined>(undefined);

  const scrollbarWidth = useMemo(() => getScrollbarWidth(), []);

  // the order of middleware is important!
  const middleware = [
    flip({
      // see https://floating-ui.com/docs/flip#combining-with-shift
      crossAxis: true,
      boundary: document.body,
    }),
    size({
      apply({ availableWidth }) {
        setPopoverMaxWidth(availableWidth);
      },
    }),
  ];
  const elements = { reference: inputRef.current, floating: floatingRef.current };
  const { floatingStyles } = useFloating({
    strategy: 'fixed',
    open: isOpen,
    placement: 'bottom-start',
    middleware,
    elements,
    whileElementsMounted: autoUpdate,
  });

  const longestItemWidth = useMemo(() => {
    let longestItem = '';
    const itemsToLookAt = Math.min(items.length, WIDTH_CALCULATION_LIMIT_ITEMS);

    for (let i = 0; i < itemsToLookAt; i++) {
      const itemLabel = items[i].label;
      longestItem = itemLabel.length > longestItem.length ? itemLabel : longestItem;
    }

    const size = measureText(longestItem, MENU_ITEM_FONT_SIZE, MENU_ITEM_FONT_WEIGHT).width;

    return size + MENU_ITEM_PADDING_X * 2 + scrollbarWidth;
  }, [items, scrollbarWidth]);

  const floatStyles = {
    ...floatingStyles,
    width: longestItemWidth,
    maxWidth: popoverMaxWidth,
    minWidth: inputRef.current?.offsetWidth,
  };

  return { inputRef, floatingRef, floatStyles };
};

// Creates a temporary div with a scrolling inner div to calculate the width of the scrollbar
function getScrollbarWidth(): number {
  const outer = document.createElement('div');
  outer.style.visibility = 'hidden';
  outer.style.overflow = 'scroll';
  document.body.appendChild(outer);

  const inner = document.createElement('div');
  outer.appendChild(inner);

  const scrollbarWidth = outer.offsetWidth - inner.offsetWidth;

  outer.parentNode?.removeChild(outer);

  return scrollbarWidth;
}
