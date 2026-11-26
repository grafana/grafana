import { useCallback, useMemo } from 'react';
import { useMeasure } from 'react-use';

import { useTheme2 } from '../../themes/ThemeContext';
import { measureText } from '../../utils/measureText';

import { type ComboboxOption } from './types';

const FONT_SIZE = 12;
const EXTRA_PILL_SIZE = 50;
const EXTRA_PILL_DISABLED_SIZE = 10;
export const MAX_SHOWN_ITEMS = 15;

/**
 * An auto sized container grows with the pills it shows, so its current width is not the limit. Like its
 * CSS max-width, it can grow up to maxWidth or its parent's width, whichever is smaller.
 */
function getAutoAvailableWidth(
  wrapperWidth: number,
  containerWidth: number,
  parentWidth: number,
  maxWidthPx: number | undefined
) {
  const maxContainerWidth = Math.min(maxWidthPx ?? Infinity, parentWidth || Infinity);
  if (!containerWidth || maxContainerWidth === Infinity) {
    return Infinity;
  }
  // Take away the space the container uses for anything other than pills (padding, border, prefix icon)
  return maxContainerWidth - (containerWidth - wrapperWidth);
}

/**
 * Updates the number of shown items in the multi combobox based on the available width.
 */
export function useMeasureMulti<T extends string | number>(
  selectedItems: Array<ComboboxOption<T>>,
  width?: number | 'auto',
  disabled?: boolean,
  maxWidth?: number
) {
  const theme = useTheme2();
  const [measureContainer, { width: containerWidth }] = useMeasure<HTMLDivElement>();
  const [measureParent, { width: parentWidth }] = useMeasure<HTMLElement>();
  const [measureRef, { width: wrapperWidth }] = useMeasure<HTMLDivElement>();
  const [counterMeasureRef, { width: counterWidth }] = useMeasure<HTMLDivElement>();
  const [suffixMeasureRef, { width: suffixWidth }] = useMeasure<HTMLDivElement>();

  const containerMeasureRef = useCallback(
    (element: HTMLDivElement | null) => {
      // null only comes on unmount, when the measurements are no longer needed
      if (!element) {
        return;
      }
      measureContainer(element);
      if (element.parentElement) {
        measureParent(element.parentElement);
      }
    },
    [measureContainer, measureParent]
  );

  const availableWidth =
    width === 'auto'
      ? getAutoAvailableWidth(
          wrapperWidth,
          containerWidth,
          parentWidth,
          maxWidth ? theme.spacing.gridSize * maxWidth : undefined
        )
      : wrapperWidth;

  const shownItems = useMemo(() => {
    if (!availableWidth) {
      return selectedItems.length;
    }
    // Measure text width and add size of padding, separator and close button
    const pillWidths = selectedItems.map(
      (item) =>
        measureText(item?.label || '', FONT_SIZE).width + (disabled ? EXTRA_PILL_DISABLED_SIZE : EXTRA_PILL_SIZE)
    );
    const maxPillsWidth = availableWidth - suffixWidth;
    if (pillWidths.reduce((sum, pillWidth) => sum + pillWidth, 0) <= maxPillsWidth) {
      return selectedItems.length;
    }

    // Some pills are hidden, so leave room for the counter. Its width is from the last time it was shown,
    // which is also why this can't be reserved up front: it would still be taken after the counter is gone.
    const maxPillsWidthWithCounter = maxPillsWidth - counterWidth;
    let currWidth = 0;
    for (let i = 0; i < pillWidths.length; i++) {
      currWidth += pillWidths[i];
      if (currWidth > maxPillsWidthWithCounter) {
        // If there is no space for that item, show the current number of items,
        // but always show at least 1 item. Cap at maximum number of items.
        return Math.min(i, MAX_SHOWN_ITEMS) || 1;
      }
    }
    return selectedItems.length;
  }, [availableWidth, counterWidth, suffixWidth, selectedItems, disabled]);

  return { containerMeasureRef, measureRef, counterMeasureRef, suffixMeasureRef, shownItems };
}
