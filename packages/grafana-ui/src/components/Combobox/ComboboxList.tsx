import { cx } from '@emotion/css';
import {
  defaultRangeExtractor,
  elementScroll,
  useVirtualizer,
  type Range,
  type Virtualizer,
  type VirtualizerOptions,
} from '@tanstack/react-virtual';
import type { UseComboboxPropGetters } from 'downshift';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useStyles2 } from '../../themes/ThemeContext';
import { Checkbox } from '../Forms/Checkbox';
import { Icon } from '../Icon/Icon';
import { Stack } from '../Layout/Stack/Stack';
import { ScrollContainer } from '../ScrollContainer/ScrollContainer';

import { AsyncError, LoadingOptions, NotFoundError } from './MessageRows';
import { getComboboxStyles, MENU_OPTION_HEIGHT, MENU_OPTION_HEIGHT_DESCRIPTION } from './getComboboxStyles';
import { ALL_OPTION_VALUE, type ComboboxOption } from './types';
import { isNewGroup } from './utils';

const VIRTUAL_OVERSCAN_ITEMS = 4;
const MAX_BROWSER_SCROLL_HEIGHT = 10_000_000;

type ComboboxVirtualizer = Virtualizer<HTMLDivElement, Element>;
type ScrollToOptions = Parameters<VirtualizerOptions<HTMLDivElement, Element>['scrollToFn']>[1];

interface ComboboxListProps<T extends string | number> {
  options: Array<ComboboxOption<T>>;
  highlightedIndex: number | null;
  selectedItems?: Array<ComboboxOption<T>>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  getItemProps: UseComboboxPropGetters<ComboboxOption<T>>['getItemProps'];
  enableAllOption?: boolean;
  isMultiSelect?: boolean;
  noOptionsMessage?: string;
  error?: boolean;
  loading?: boolean;
}

export const ComboboxList = <T extends string | number>({
  options,
  highlightedIndex,
  selectedItems = [],
  scrollRef,
  getItemProps,
  enableAllOption,
  isMultiSelect = false,
  error = false,
  loading = false,
  noOptionsMessage,
}: ComboboxListProps<T>) => {
  const styles = useStyles2(getComboboxStyles);

  const estimateSize = useCallback(
    (index: number) => {
      const firstGroupItem = isNewGroup(options[index], index > 0 ? options[index - 1] : undefined);
      const hasDescription = 'description' in options[index];
      const hasGroup = 'group' in options[index];

      let itemHeight = MENU_OPTION_HEIGHT;
      if (hasDescription) {
        itemHeight = MENU_OPTION_HEIGHT_DESCRIPTION;
      }
      if (firstGroupItem && hasGroup) {
        itemHeight += MENU_OPTION_HEIGHT;
      }
      return itemHeight;
    },
    [options]
  );

  const logicalTotalSize = useMemo(() => {
    return options.reduce((total, _, index) => total + estimateSize(index), 0);
  }, [estimateSize, options]);

  const physicalTotalSize = Math.min(logicalTotalSize, MAX_BROWSER_SCROLL_HEIGHT);
  const usesScaledScrolling = logicalTotalSize > physicalTotalSize;
  const scrollScalingRef = useRef({ logicalTotalSize, physicalTotalSize, usesScaledScrolling });
  scrollScalingRef.current = { logicalTotalSize, physicalTotalSize, usesScaledScrolling };

  const getScrollScale = useCallback(
    (element: Element) => {
      const { logicalTotalSize, physicalTotalSize, usesScaledScrolling } = scrollScalingRef.current;

      if (!usesScaledScrolling) {
        return 1;
      }

      const viewportSize = element.clientHeight;
      const logicalScrollableSize = Math.max(1, logicalTotalSize - viewportSize);
      const physicalScrollableSize = Math.max(1, physicalTotalSize - viewportSize);

      return logicalScrollableSize / physicalScrollableSize;
    },
    []
  );

  const observeScaledElementOffset = useCallback(
    (instance: ComboboxVirtualizer, callback: (offset: number, isScrolling: boolean) => void) => {
      const element = instance.scrollElement;
      if (!element) {
        return;
      }

      const targetWindow = element.ownerDocument.defaultView;
      let resetIsScrollingId: number | undefined;

      const notify = (isScrolling: boolean) => {
        callback(element.scrollTop * getScrollScale(element), isScrolling);
      };

      const handleScroll = () => {
        notify(true);

        if (resetIsScrollingId !== undefined) {
          targetWindow?.clearTimeout(resetIsScrollingId);
        }

        resetIsScrollingId = targetWindow?.setTimeout(() => {
          notify(false);
        }, instance.options.isScrollingResetDelay);
      };

      notify(false);
      element.addEventListener('scroll', handleScroll);

      return () => {
        if (resetIsScrollingId !== undefined) {
          targetWindow?.clearTimeout(resetIsScrollingId);
        }
        element.removeEventListener('scroll', handleScroll);
      };
    },
    [getScrollScale]
  );

  const scrollToScaledOffset = useCallback(
    (offset: number, options: ScrollToOptions, instance: ComboboxVirtualizer) => {
      if (!usesScaledScrolling || !instance.scrollElement) {
        elementScroll(offset, options, instance);
        return;
      }

      const adjustedOffset = offset + (options.adjustments ?? 0);
      const physicalOffset = adjustedOffset / getScrollScale(instance.scrollElement);

      instance.scrollElement.scrollTo({
        top: physicalOffset,
        behavior: options.behavior,
      });
    },
    [getScrollScale, usesScaledScrolling]
  );

  const groupStartIndices = useMemo(() => {
    const indices = new Map<string, number>();

    for (let index = 0; index < options.length; index++) {
      const item = options[index];
      const previousItem = index > 0 ? options[index - 1] : undefined;

      if (item.group && isNewGroup(item, previousItem)) {
        indices.set(item.group, index);
      }
    }

    return indices;
  }, [options]);

  const rangeExtractor = useCallback(
    (range: Range) => {
      const rangeToReturn = defaultRangeExtractor(range);
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
    getItemKey: (index: number) => options[index]?.value ?? index,
    observeElementOffset: observeScaledElementOffset,
    scrollToFn: scrollToScaledOffset,
    overscan: VIRTUAL_OVERSCAN_ITEMS,
    rangeExtractor,
  });

  useEffect(() => {
    if (highlightedIndex !== null && highlightedIndex >= 0 && highlightedIndex < options.length) {
      rowVirtualizer.scrollToIndex(highlightedIndex);
    }
  }, [highlightedIndex, options.length, rowVirtualizer]);

  const isOptionSelected = useCallback(
    (item: ComboboxOption<T>) => selectedItems.some((opt) => opt.value === item.value),
    [selectedItems]
  );

  const allItemsSelected = enableAllOption && options.length > 1 && selectedItems.length === options.length - 1;

  return (
    <ScrollContainer showScrollIndicators maxHeight="inherit" ref={scrollRef} padding={0.5}>
      <div style={{ height: physicalTotalSize }} className={styles.menuUlContainer}>
        {rowVirtualizer.getVirtualItems().map((virtualRow, index, allVirtualRows) => {
          const item = options[virtualRow.index];
          const startingNewGroup = isNewGroup(item, options[virtualRow.index - 1]);
          const logicalOffset = rowVirtualizer.scrollOffset ?? 0;
          const physicalOffset = scrollRef.current ? logicalOffset / getScrollScale(scrollRef.current) : logicalOffset;
          const virtualRowStart = usesScaledScrolling
            ? physicalOffset + virtualRow.start - logicalOffset
            : virtualRow.start;

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
                transform: `translateY(${virtualRowStart}px)`,
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
                  !isMultiSelect && isOptionSelected(item) && styles.optionSelected,
                  highlightedIndex === virtualRow.index && !item.infoOption && styles.optionFocused,
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

                <div className={styles.optionBody}>
                  <Stack direction="row" alignItems="center">
                    {item.icon && <Icon name={item.icon} />}
                    <div className={styles.optionLabel}>{item.label ?? item.value}</div>
                  </Stack>

                  {item.description && <div className={styles.optionDescription}>{item.description}</div>}
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
