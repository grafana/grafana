import { autoUpdate, autoPlacement, size, useFloating } from '@floating-ui/react';
import { useMemo, useRef, useState } from 'react';

import { measureText } from '../../utils/measureText';

import {
  MENU_ITEM_FONT_SIZE,
  MENU_ITEM_FONT_WEIGHT,
  MENU_ITEM_PADDING,
  MENU_OPTION_HEIGHT,
  POPOVER_MAX_HEIGHT,
} from './getComboboxStyles';
import { ComboboxOption } from './types';

// Only consider the first n items when calculating the width of the popover.
const WIDTH_CALCULATION_LIMIT_ITEMS = 100_000;

// Clearance around the popover to prevent it from being too close to the edge of the viewport
const POPOVER_PADDING = 16;

const SCROLL_CONTAINER_PADDING = 8;

export const useComboboxFloat = (items: Array<ComboboxOption<string | number>>, isOpen: boolean) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const floatingRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [popoverMaxSize, setPopoverMaxSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  }); // set initial values to prevent infinite size, briefly removing the list virtualization

  const scrollbarWidth = useMemo(() => getScrollbarWidth(), []);

  // the order of middleware is important!
  const middleware = [
    autoPlacement({
      // see https://floating-ui.com/docs/autoplacement
      allowedPlacements: ['bottom-start', 'bottom-end', 'top-start', 'top-end'],
      boundary: document.body,
      crossAxis: true,
    }),
    size({
      apply({ availableWidth, availableHeight }) {
        const preferredMaxWidth = availableWidth - POPOVER_PADDING;
        const preferredMaxHeight = availableHeight - POPOVER_PADDING;

        const width = Math.max(preferredMaxWidth, 0);
        const height = Math.min(Math.max(preferredMaxHeight, MENU_OPTION_HEIGHT * 6), POPOVER_MAX_HEIGHT);

        setPopoverMaxSize({ width, height });
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
      const itemLabel = items[i].label ?? items[i].value.toString();
      longestItem = itemLabel.length > longestItem.length ? itemLabel : longestItem;
    }

    const size = measureText(longestItem, MENU_ITEM_FONT_SIZE, MENU_ITEM_FONT_WEIGHT).width;

    return size + SCROLL_CONTAINER_PADDING + MENU_ITEM_PADDING * 2 + scrollbarWidth;
  }, [items, scrollbarWidth]);

  const floatStyles = {
    ...floatingStyles,
    width: longestItemWidth,
    maxWidth: popoverMaxSize.width,
    minWidth: inputRef.current?.offsetWidth,

    maxHeight: popoverMaxSize.height,
  };

  return { inputRef, floatingRef, scrollRef, floatStyles };
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
