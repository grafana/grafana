import { SortOrder } from 'app/core/utils/explore';
import { DataLink } from '@grafana/data';

export interface Options {
  showTime: boolean;
  sortOrder: SortOrder;
  dataLinks: DataLink[];
}

export const defaults: Options = {
  showTime: true,
  sortOrder: SortOrder.Descending,
  dataLinks: [],
};
