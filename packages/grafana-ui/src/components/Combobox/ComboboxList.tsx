import { cx } from '@emotion/css';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { UseComboboxPropGetters } from 'downshift';
import { useCallback } from 'react';

import { useStyles2 } from '../../themes';
import { Checkbox } from '../Forms/Checkbox';
import { ScrollContainer } from '../ScrollContainer/ScrollContainer';

import { NotFoundError } from './MessageRows';
import { getComboboxStyles, MENU_OPTION_HEIGHT, MENU_OPTION_HEIGHT_DESCRIPTION } from './getComboboxStyles';
import { ComboboxOption } from './types';
import { isNewGroup } from './utils';

export const VIRTUAL_OVERSCAN_ITEMS = 4;

interface ComboboxListProps<T extends string | number> {
  options: Array<ComboboxOption<T>>;
  highlightedIndex: number | null;
  selectedItems?: Array<ComboboxOption<T>>;
  scrollRef: React.RefObject<HTMLDivElement>;
  getItemProps: UseComboboxPropGetters<ComboboxOption<T>>['getItemProps'];
  enableAllOption?: boolean;
  isMultiSelect?: boolean;
}

export const ComboboxList = <T extends string | number>({
  options,
  highlightedIndex,
  selectedItems = [],
  scrollRef,
  getItemProps,
  enableAllOption,
  isMultiSelect = false,
}: ComboboxListProps<T>) => {
  const styles = useStyles2(getComboboxStyles);

  const estimateSize = useCallback(
    (index: number) => {
      const firstGroupItem = isNewGroup(options[index], index > 0 ? options[index - 1] : undefined);
      const hasDescription = 'description' in options[index];
      let itemHeight = MENU_OPTION_HEIGHT;
      if (hasDescription) {
        itemHeight = MENU_OPTION_HEIGHT_DESCRIPTION;
      }
      if (firstGroupItem) {
        itemHeight += MENU_OPTION_HEIGHT;
      }
      return itemHeight;
    },
    [options]
  );

  const rowVirtualizer = useVirtualizer({
    count: options.length,
    getScrollElement: () => scrollRef.current,
    estimateSize,
    overscan: VIRTUAL_OVERSCAN_ITEMS,
  });

  const isOptionSelected = useCallback(
    (item: ComboboxOption<T>) => selectedItems.some((opt) => opt.value === item.value),
    [selectedItems]
  );

  const allItemsSelected = enableAllOption && selectedItems.length === options.length - 1;

  return (
    <ScrollContainer showScrollIndicators maxHeight="inherit" ref={scrollRef} padding={0.5}>
      <div style={{ height: rowVirtualizer.getTotalSize() }} className={styles.menuUlContainer}>
        {rowVirtualizer.getVirtualItems().map((virtualRow, index, allVirtualRows) => {
          const item = options[virtualRow.index];
          const startingNewGroup = isNewGroup(item, options[virtualRow.index - 1]);

          // Find the item that renders the group header. It can be this same item if this is rendering it.
          const groupHeaderIndex = allVirtualRows.find((row) => {
            const rowItem = options[row.index];
            return rowItem.group === item.group;
          });
          const groupHeaderItem = groupHeaderIndex && options[groupHeaderIndex.index];

          const itemId = `combobox-option-${item.value}`;
          // If we're rendering the group header, this is the ID for it. Otherwise its used on
          // the option for aria-describedby.
          const groupHeaderId = groupHeaderItem ? `combobox-option-group-${groupHeaderItem.value}` : undefined;

          return (
            // Wrapping div should have no styling other than virtual list positioning.
            // It's children (header and option) should appear as flat list items.
            <div
              key={item.value}
              className={styles.listItem}
              style={{
                height: virtualRow.size,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {/* Group header */}
              {startingNewGroup && (
                <div
                  role="presentation"
                  id={groupHeaderId}
                  className={cx(
                    styles.optionGroupHeader,
                    item.group && styles.newOptionGroupLabel,
                    virtualRow.index === 0 && styles.newOptionGroupNoBorder
                  )}
                >
                  {item.group}
                </div>
              )}

              {/* Option */}
              <div
                className={cx(
                  styles.option,
                  !isMultiSelect && isOptionSelected(item) && styles.optionSelected,
                  highlightedIndex === virtualRow.index && styles.optionFocused
                )}
                {...getItemProps({
                  item: item,
                  index: virtualRow.index,
                  id: itemId,
                  'aria-describedby': groupHeaderId,
                })}
              >
                {isMultiSelect && (
                  <div className={styles.optionAccessory}>
                    <Checkbox
                      key={itemId}
                      value={allItemsSelected || isOptionSelected(item)}
                      indeterminate={item.value === 'all' && selectedItems.length > 0 && !allItemsSelected}
                      aria-labelledby={itemId}
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    />
                  </div>
                )}

                {/* <div className={styles.optionAccessory}>
                  <Icon name="external-link-alt" />
                </div> */}

                <div className={styles.optionBody}>
                  {/* TODO: need to add back the 'select all' thing */}
                  <div className={styles.optionLabel}>{item.label ?? item.value}</div>

                  {item.description && <div className={styles.optionDescription}>{item.description}</div>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* TODO: missing other messages, like async error? */}
      <div aria-live="polite">{options.length === 0 && <NotFoundError />}</div>
    </ScrollContainer>
  );
};
