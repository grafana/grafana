import { autoUpdate, flip, size, useFloating } from '@floating-ui/react';
import { useMemo, useRef, useState } from 'react';

import { measureText } from '../../utils';

import { ComboboxOption } from './Combobox';
import { MENU_ITEM_FONT_SIZE } from './getComboboxStyles';

// Only consider the first n items when calculating the width of the popover.
const WIDTH_CALCULATION_LIMIT_ITEMS = 1000;

// // On every 100th index we will recalculate the width of the popover.
// const INDEX_WIDTH_CALCULATION = 100;

// // A multiplier guesstimate times the amount of characters. If any padding or image support etc. is added this will need to be updated.
// const WIDTH_MULTIPLIER = 7.3;

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

    // pr todo: get weight from theme/styles
    const size = measureText(longestItem, MENU_ITEM_FONT_SIZE, 500).width;

    // pr todo: ideally we want to remove these magic numbers from here, or derive them from the styles
    return size + 16 /* padding */ + 17 /* chrome fixed scrollbar width */;
  }, [items]);

  const floatStyles = {
    ...floatingStyles,
    width: longestItemWidth,
    maxWidth: popoverMaxWidth,
    minWidth: inputRef.current?.offsetWidth,
  };

  return { inputRef, floatingRef, floatStyles };
};
