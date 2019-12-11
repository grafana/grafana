import { SortOrder } from 'app/core/utils/explore';

export interface Options {
  showLabels: boolean;
  showTime: boolean;
  wrapLogMessage: boolean;
  sortOrder: SortOrder;
}

export const defaults: Options = {
  showLabels: false,
  showTime: true,
  wrapLogMessage: true,
  sortOrder: SortOrder.Descending,
};
