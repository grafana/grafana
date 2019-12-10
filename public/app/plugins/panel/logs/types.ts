import { SortOrder } from 'app/core/utils/explore';

export interface Options {
  showTime: boolean;
  wrapLogMessage: boolean;
  sortOrder: SortOrder;
}

export const defaults: Options = {
  showTime: true,
  wrapLogMessage: true,
  sortOrder: SortOrder.Descending,
};
