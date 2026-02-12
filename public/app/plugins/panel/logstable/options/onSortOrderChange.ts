import { LogsSortOrder } from '@grafana/data';

import { Options } from './types';

export const onSortOrderChange = (options: Options, sortOrder: LogsSortOrder, timeFieldName: string) => {
  if (options.sortOrder !== sortOrder) {
    const newSortBy = {
      desc: options.sortOrder === LogsSortOrder.Descending,
      displayName: timeFieldName,
    };
    const existingSortByIdx = options.sortBy?.findIndex((option) => option.displayName === timeFieldName);
    if (options.sortBy && existingSortByIdx !== undefined && existingSortByIdx !== -1) {
      options.sortBy[existingSortByIdx] = newSortBy;
    } else {
      options.sortBy = [{ ...newSortBy }, ...(options?.sortBy ?? [])];
    }

    // Deep copy is required or the useEffects on sortBy will not trigger re-render!
    return { ...options };
  }

  return options;
};
