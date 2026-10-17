import { cx } from '@emotion/css';
import { useVirtualizer, type Range } from '@tanstack/react-virtual';
import type { UseComboboxPropGetters } from 'downshift';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useStyles2 } from '../../themes/ThemeContext';
import { Checkbox } from '../Forms/Checkbox';
import { Icon } from '../Icon/Icon';
import { Stack } from '../Layout/Stack/Stack';
import { ScrollContainer } from '../ScrollContainer/ScrollContainer';

import { AsyncError, LoadingOptions, NotFoundError } from './MessageRows';
import {
  getComboboxStyles,
  MENU_OPTION_HEIGHT,
  MENU_OPTION_HEIGHT_DESCRIPTION,
  MENU_PADDING,
} from './getComboboxStyles';
import { ALL_OPTION_VALUE, type ComboboxOption } from './types';
import { isNewGroup } from './utils';

const VIRTUAL_OVERSCAN_ITEMS = 4;
// Leave room for a two-line custom option before its measured height is known.
const DYNAMIC_OPTION_HEIGHT_ESTIMATE = MENU_OPTION_HEIGHT_DESCRIPTION + MENU_PADDING;

interface ComboboxListProps<T extends string | number> {
  options: Array<ComboboxOption<T>>;
  renderOption?: (option: ComboboxOption<T>) => React.ReactNode;
  customValueOption?: ComboboxOption<T>;
  allOption?: ComboboxOption<T>;
  highlightedIndex: number | null;
  /** Whether the highlighted option should show a focus ring, rather than just the muted highlight */
  showFocusRing?: boolean;
  selectedItems?: Array<ComboboxOption<T>>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  getItemProps: UseComboboxPropGetters<ComboboxOption<T>>['getItemProps'];
  enableAllOption?: boolean;
  isMultiSelect?: boolean;
  noOptionsMessage?: string;
  error?: boolean;
  loading?: boolean;
}

export const ComboboxList = <T extends string | number>(props: ComboboxListProps<T>) => {
  const dynamicOptionHeight = props.renderOption !== undefined;

  return (
    <VirtualizedComboboxList
      key={dynamicOptionHeight ? 'dynamic' : 'fixed'}
      {...props}
      dynamicOptionHeight={dynamicOptionHeight}
    />
  );
};

const VirtualizedComboboxList = <T extends string | number>({
  options,
  renderOption,
  dynamicOptionHeight,
  customValueOption,
  allOption,
  highlightedIndex,
  showFocusRing = false,
  selectedItems = [],
  scrollRef,
  getItemProps,
  enableAllOption,
  isMultiSelect = false,
  error = false,
  loading = false,
  noOptionsMessage,
}: ComboboxListProps<T> & { dynamicOptionHeight: boolean }) => {
  const styles = useStyles2(getComboboxStyles);
  const groupStartIndices = useMemo(() => {
    const indices = new Map<string, number>();

    options.forEach((option, index) => {
      if (option.group && isNewGroup(option, options[index - 1])) {
        indices.set(option.group, index);
      }
    });

    return indices;
  }, [options]);

  const estimateSize = useCallback(
    (index: number) => {
      const firstGroupItem = isNewGroup(options[index], index > 0 ? options[index - 1] : undefined);
      const hasGroup = 'group' in options[index];

      if (dynamicOptionHeight) {
        return DYNAMIC_OPTION_HEIGHT_ESTIMATE + (firstGroupItem && hasGroup ? MENU_OPTION_HEIGHT : 0);
      }

      return (
        ('description' in options[index] ? MENU_OPTION_HEIGHT_DESCRIPTION : MENU_OPTION_HEIGHT) +
        (firstGroupItem && hasGroup ? MENU_OPTION_HEIGHT : 0)
      );
    },
    [dynamicOptionHeight, options]
  );

  const getItemKey = useCallback((index: number) => options[index]?.value ?? index, [options]);

  const rangeExtractor = useCallback(
    (range: Range) => {
      const startIndex = Math.max(0, range.startIndex - range.overscan);
      const endIndex = Math.min(options.length - 1, range.endIndex + range.overscan);
      const rangeToReturn = Array.from({ length: endIndex - startIndex + 1 }, (_, index) => startIndex + index);
      const firstDisplayedOption = options[rangeToReturn[0]];

      if (firstDisplayedOption?.group) {
        const groupStartIndex = groupStartIndices.get(firstDisplayedOption.group);
        if (groupStartIndex !== undefined && groupStartIndex < rangeToReturn[0]) {
          rangeToReturn.unshift(groupStartIndex);
        }
      }

      return rangeToReturn;
    },
    [groupStartIndices, options]
  );

  const rowVirtualizer = useVirtualizer({
    count: options.length,
    getScrollElement: () => scrollRef.current,
    estimateSize,
    getItemKey,
    overscan: VIRTUAL_OVERSCAN_ITEMS,
    rangeExtractor,
    // Vertical padding belongs to the virtualizer rather than CSS so that row offsets, the total
    // size and scrollToIndex all account for it. Padding it in CSS instead would shift every row
    // down without the virtualizer knowing, and scrolling would stop short of the focus ring.
    paddingStart: MENU_PADDING,
    paddingEnd: MENU_PADDING,
  });
  const { scrollToIndex } = rowVirtualizer;
  const previousHighlightedIndex = useRef<number | null>(highlightedIndex === null || highlightedIndex <= 0 ? 0 : null);

  useEffect(() => {
    if (highlightedIndex === null || highlightedIndex < 0) {
      return;
    }

    if (highlightedIndex === previousHighlightedIndex.current) {
      return;
    }

    previousHighlightedIndex.current = highlightedIndex;

    scrollToIndex(highlightedIndex, { align: 'auto' });
  }, [highlightedIndex, scrollToIndex]);

  const isOptionSelected = useCallback(
    (item: ComboboxOption<T>) => selectedItems.some((opt) => opt.value === item.value),
    [selectedItems]
  );

  const allItemsSelected = enableAllOption && options.length > 1 && selectedItems.length === options.length - 1;

  return (
    <ScrollContainer showScrollIndicators maxHeight="inherit" ref={scrollRef}>
      <div style={{ height: rowVirtualizer.getTotalSize() }} className={styles.menuUlContainer}>
        {rowVirtualizer.getVirtualItems().map((virtualRow, index, allVirtualRows) => {
          const item = options[virtualRow.index];
          const startingNewGroup = isNewGroup(item, options[virtualRow.index - 1]);
          const isHighlighted = highlightedIndex === virtualRow.index && !item.infoOption;

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
              key={virtualRow.key}
              ref={dynamicOptionHeight ? rowVirtualizer.measureElement : undefined}
              data-index={dynamicOptionHeight ? virtualRow.index : undefined}
              className={styles.listItem}
              style={{
                height: dynamicOptionHeight ? undefined : virtualRow.size,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {/* Group header */}
              {startingNewGroup && (
                <div
                  role="presentation"
                  data-testid="combobox-option-group"
                  id={groupHeaderId}
                  className={cx(
                    styles.optionGroupHeader,
                    item.group && styles.optionGroupLabel,
                    virtualRow.index === 0 && styles.optionFirstGroupHeader
                  )}
                >
                  {item.group}
                </div>
              )}

              {/* Option */}
              <div
                className={cx(
                  styles.option,
                  dynamicOptionHeight && styles.optionDynamic,
                  !isMultiSelect && isOptionSelected(item) && styles.optionSelected,
                  isHighlighted && styles.optionFocused,
                  isHighlighted && showFocusRing && styles.optionFocusRing,
                  item.infoOption && styles.optionInfo
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
                    {!item.infoOption && (
                      <Checkbox
                        key={itemId}
                        value={allItemsSelected || isOptionSelected(item)}
                        indeterminate={item.value === ALL_OPTION_VALUE && selectedItems.length > 0 && !allItemsSelected}
                        aria-labelledby={itemId}
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                        data-testid={`${itemId}-checkbox`}
                      />
                    )}
                  </div>
                )}

                <div className={cx(styles.optionBody, dynamicOptionHeight && styles.optionBodyDynamic)}>
                  {renderOption && item !== customValueOption && item !== allOption ? (
                    renderOption(item)
                  ) : (
                    <>
                      <Stack direction="row" alignItems="center">
                        {item.icon && <Icon name={item.icon} />}
                        <div className={styles.optionLabel}>{item.label ?? item.value}</div>
                      </Stack>

                      {item.description && <div className={styles.optionDescription}>{item.description}</div>}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div aria-live="polite">
        {error && <AsyncError />}
        {!loading && options.length === 0 && !error && <NotFoundError message={noOptionsMessage} />}
        {loading && options.length === 0 && <LoadingOptions />}
      </div>
    </ScrollContainer>
  );
};
