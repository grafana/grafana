import { useMemo } from 'react';
import { useMeasure } from 'react-use';

import { measureText } from '../../utils/measureText';

import { type ComboboxOption } from './types';

const FONT_SIZE = 12;
const EXTRA_PILL_SIZE = 50;
const EXTRA_PILL_DISABLED_SIZE = 10;
export const MAX_SHOWN_ITEMS = 15;

/**
 * Updates the number of shown items in the multi combobox based on the available width.
 */
export function useMeasureMulti<T extends string | number>(
  selectedItems: Array<ComboboxOption<T>>,
  width?: number | 'auto',
  disabled?: boolean
) {
  const [measureRef, { width: containerWidth }] = useMeasure<HTMLDivElement>();
  const [counterMeasureRef, { width: counterWidth }] = useMeasure<HTMLDivElement>();
  const [suffixMeasureRef, { width: suffixWidth }] = useMeasure<HTMLDivElement>();

  const finalWidth = width && width !== 'auto' ? width : containerWidth;

  const shownItems = useMemo(() => {
    const maxWidth = finalWidth - counterWidth - suffixWidth;
    let currWidth = 0;
    for (let i = 0; i < selectedItems.length; i++) {
      // Measure text width and add size of padding, separator and close button
      currWidth +=
        measureText(selectedItems[i]?.label || '', FONT_SIZE).width +
        (disabled ? EXTRA_PILL_DISABLED_SIZE : EXTRA_PILL_SIZE);
      if (currWidth > maxWidth) {
        // If there is no space for that item, show the current number of items,
        // but always show at least 1 item. Cap at maximum number of items.
        return Math.min(i, MAX_SHOWN_ITEMS) || 1;
      }
    }
    return selectedItems.length;
  }, [finalWidth, counterWidth, suffixWidth, selectedItems, disabled]);

  return { measureRef, counterMeasureRef, suffixMeasureRef, shownItems };
}
