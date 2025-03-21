import { autoUpdate, flip, size, useFloating } from '@floating-ui/react';
import { useMemo, useRef, useState } from 'react';

import { measureText } from '../../utils';

import {
  MENU_ITEM_FONT_SIZE,
  MENU_ITEM_FONT_WEIGHT,
  MENU_ITEM_PADDING,
  MENU_OPTION_HEIGHT,
  MENU_OPTION_HEIGHT_DESCRIPTION,
  POPOVER_MAX_HEIGHT,
} from './getComboboxStyles';
import { ComboboxOption } from './types';

// Only consider the first n items when calculating the width of the popover.
const WIDTH_CALCULATION_LIMIT_ITEMS = 100_000;

// Clearance around the popover to prevent it from being too close to the edge of the viewport
const POPOVER_PADDING = 16;

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
    flip({
      // see https://floating-ui.com/docs/flip#combining-with-shift
      crossAxis: true,
      boundary: document.body,
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
    const maxItemsLength = Math.min(items.length, WIDTH_CALCULATION_LIMIT_ITEMS);
    const itemsToLookAt = items.slice(0, maxItemsLength);

    let longestItem = '';
    let withIcon = false;
    let withDescription = false;

    for (const item of itemsToLookAt) {
      const itemLabel = item.label ?? item.value.toString();
      longestItem = itemLabel.length > longestItem.length ? itemLabel : longestItem;
      withIcon ||= !!item.imgUrl;
      withDescription ||= !!item.description;
    }

    const textWidth = measureText(longestItem, MENU_ITEM_FONT_SIZE, MENU_ITEM_FONT_WEIGHT).width;

    let adjustedSize = textWidth + MENU_ITEM_PADDING * 2 + scrollbarWidth;
    if (withIcon && withDescription) {
      adjustedSize += MENU_OPTION_HEIGHT_DESCRIPTION - MENU_ITEM_PADDING;
    } else if (withIcon) {
      adjustedSize += MENU_OPTION_HEIGHT - MENU_ITEM_PADDING;
    }

    return adjustedSize;
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
