import { autoUpdate, flip, size, useFloating } from '@floating-ui/react';
import { useEffect, useRef, useState } from 'react';

import { ComboboxOption } from './Combobox';

// On every 100th index we will recalculate the width of the popover.
const INDEX_WIDTH_CALCULATION = 100;
// A multiplier guesstimate times the amount of characters. If any padding or image support etc. is added this will need to be updated.
const WIDTH_MULTIPLIER = 7.3;

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
  const [popoverWidth, setPopoverWidth] = useState<number | undefined>(undefined);
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

  useEffect(() => {
    if (range === null) {
      return;
    }
    const startVisibleIndex = range?.startIndex;
    const endVisibleIndex = range?.endIndex;

    if (typeof startVisibleIndex === 'undefined' || typeof endVisibleIndex === 'undefined') {
      return;
    }

    // Scroll down and default case
    if (
      startVisibleIndex === 0 ||
      (startVisibleIndex % INDEX_WIDTH_CALCULATION === 0 && startVisibleIndex >= INDEX_WIDTH_CALCULATION)
    ) {
      let maxLength = 0;
      const calculationEnd = Math.min(items.length, endVisibleIndex + INDEX_WIDTH_CALCULATION);

      for (let i = startVisibleIndex; i < calculationEnd; i++) {
        maxLength = Math.max(maxLength, items[i].label.length);
      }

      setPopoverWidth(maxLength * WIDTH_MULTIPLIER);
    } else if (endVisibleIndex % INDEX_WIDTH_CALCULATION === 0 && endVisibleIndex >= INDEX_WIDTH_CALCULATION) {
      // Scroll up case
      let maxLength = 0;
      const calculationStart = Math.max(0, startVisibleIndex - INDEX_WIDTH_CALCULATION);

      for (let i = calculationStart; i < endVisibleIndex; i++) {
        maxLength = Math.max(maxLength, items[i].label.length);
      }

      setPopoverWidth(maxLength * WIDTH_MULTIPLIER);
    }
  }, [items, range, setPopoverWidth]);

  const floatStyles = {
    ...floatingStyles,
    width: popoverWidth,
    maxWidth: popoverMaxWidth,
    minWidth: inputRef.current?.offsetWidth,
  };

  return { inputRef, floatingRef, floatStyles };
};
