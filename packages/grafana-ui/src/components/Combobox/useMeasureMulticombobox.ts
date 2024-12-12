import { useEffect } from 'react';

import { measureText } from '../../utils';

import { ComboboxOption } from './Combobox';

const FONT_SIZE = 12;
const EXTRA_PILL_SIZE = 50;

/**
 * Updates the number of shown items in the multi combobox based on the available width.
 */
export function useMeasureMultiCombobox<T extends string | number>(
  containerWidth: number,
  suffixWidth: number,
  selectedItems: Array<ComboboxOption<T>>,
  setShownItems: (val: number) => void
) {
  useEffect(() => {
    const maxWidth = containerWidth - suffixWidth;
    let currWidth = 0;
    for (let i = 0; i < selectedItems.length; i++) {
      // Measure text width and add size of padding, separator and close button
      currWidth += measureText(selectedItems[i].label || '', FONT_SIZE).width + EXTRA_PILL_SIZE;
      if (currWidth > maxWidth) {
        // If there is no space for that item, show the current number of items,
        // but always show at least 1 item
        setShownItems(i || 1);
        break;
      }
      if (i === selectedItems.length - 1) {
        // If it is the last item, show all items
        setShownItems(selectedItems.length);
      }
    }
  }, [containerWidth, suffixWidth, selectedItems, setShownItems]);
}
