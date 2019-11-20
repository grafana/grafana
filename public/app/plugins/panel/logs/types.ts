import { SortOrder } from 'app/core/utils/explore';

export interface Options {
  showTime: boolean;
  sortOrder: SortOrder;
}

export const defaults: Options = {
  showTime: true,
  sortOrder: SortOrder.Descending,
};
