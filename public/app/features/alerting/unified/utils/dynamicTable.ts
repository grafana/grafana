import { DynamicTableItemProps } from '../components/DynamicTable';

export const prepareItems = <T = any>(
  items: T[],
  idCreator?: (item: T) => number | string
): Array<DynamicTableItemProps<T>> =>
  items.map((item, index) => ({
    id: idCreator?.(item) ?? index,
    data: item,
  }));

export const collapseItem = <T = any>(
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

export const expandItem = <T = any>(
  items: Array<DynamicTableItemProps<T>>,
  item: DynamicTableItemProps<T>
): Array<DynamicTableItemProps<T>> =>
  items.map((currentItem) => {
    if (currentItem !== item) {
      return currentItem;
    }

    return {
      ...currentItem,
      isExpanded: true,
    };
  });
