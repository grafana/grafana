import { LogsSortOrder } from '@grafana/data';

import { Options } from './types';

export const onSortOrderChange = (options: Options, sortOrder: LogsSortOrder, timeFieldName: string) => {
  if (options.sortOrder !== sortOrder) {
    const newSortBy = {
      desc: options.sortOrder === LogsSortOrder.Descending,
      displayName: timeFieldName,
    };
    let sortBy = options.sortBy ? [...options.sortBy] : undefined;
    const existingSortByIdx = sortBy?.findIndex((option) => option.displayName === timeFieldName);
    if (sortBy && existingSortByIdx !== undefined && existingSortByIdx !== -1) {
      sortBy[existingSortByIdx] = newSortBy;
    } else {
      sortBy = [{ ...newSortBy }, ...(sortBy ?? [])];
    }

    return { ...options, sortBy };
  }

  return options;
};
