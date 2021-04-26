import { DynamicTableItemProps } from '../components/DynamicTable';

export const prepareItems = <T = unknown>(
  items: T[],
  idCreator?: (item: T) => number | string
): Array<DynamicTableItemProps<T>> =>
  items.map((item, index) => ({
    id: idCreator?.(item) ?? index,
    data: item,
  }));

export const collapseItem = <T = unknown>(
  items: Array<DynamicTableItemProps<T>>,
  item: DynamicTableItemProps<T>
): Array<DynamicTableItemProps<T>> =>
  items.map((currentItem) => {
    if (currentItem !== item) {
      return currentItem;
    }

    return {
      ...currentItem,
      isExpanded: false,
    };
  });

export const expandItem = <T = unknown>(
  items: Array<DynamicTableItemProps<T>>,
  item: DynamicTableItemProps<T>,
  renderExpandedContent?: DynamicTableItemProps['renderExpandedContent']
): Array<DynamicTableItemProps<T>> =>
  items.map((currentItem) => {
    if (currentItem !== item) {
      return currentItem;
    }

    return {
      ...currentItem,
      isExpanded: true,
      renderExpandedContent,
    };
  });
