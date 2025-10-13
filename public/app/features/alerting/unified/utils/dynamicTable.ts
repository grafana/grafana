import { DynamicTableItemProps } from '../components/DynamicTable';

export const prepareItems = <T = unknown>(
  items: T[],
  idCreator?: (item: T) => number | string
): Array<DynamicTableItemProps<T>> =>
  items.map((item, index) => ({
    id: idCreator?.(item) ?? index,
    data: item,
  }));
