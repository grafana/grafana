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
  itemId: DynamicTableItemProps<T>['id']
): Array<DynamicTableItemProps<T>> =>
  items.map((currentItem) => {
    if (currentItem.id !== itemId) {
      return currentItem;
    }

    return {
      ...currentItem,
      isExpanded: false,
    };
  });

export const expandItem = <T = unknown>(
  items: Array<DynamicTableItemProps<T>>,
  itemId: DynamicTableItemProps<T>['id']
): Array<DynamicTableItemProps<T>> =>
  items.map((currentItem) => {
    if (currentItem.id !== itemId) {
      return currentItem;
    }

    return {
      ...currentItem,
      isExpanded: true,
    };
  });

export const addCustomExpandedContent = <T = unknown>(
  items: Array<DynamicTableItemProps<T>>,
  itemId: DynamicTableItemProps<T>['id'],
  renderExpandedContent: DynamicTableItemProps['renderExpandedContent']
): Array<DynamicTableItemProps<T>> =>
  items.map((currentItem) => {
    if (currentItem.id !== itemId) {
      return currentItem;
    }

    return {
      ...currentItem,
      renderExpandedContent,
    };
  });

export const removeCustomExpandedContent = <T = unknown>(
  items: Array<DynamicTableItemProps<T>>,
  itemId: DynamicTableItemProps<T>['id']
): Array<DynamicTableItemProps<T>> =>
  items.map((currentItem) => {
    if (currentItem.id !== itemId) {
      return currentItem;
    }

    return {
      ...currentItem,
      renderExpandedContent: undefined,
    };
  });
