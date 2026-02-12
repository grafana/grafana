import { LogsSortOrder } from '@grafana/data';

import { Options } from './types';

export const onSortOrderChange = (pendingOptions: Options, currentSortOrder: LogsSortOrder, timeFieldName: string) => {
  if (pendingOptions.sortOrder !== currentSortOrder) {
    const newSortBy = {
      desc: pendingOptions.sortOrder === LogsSortOrder.Descending,
      displayName: timeFieldName,
    };
    let sortBy = pendingOptions.sortBy ? [...pendingOptions.sortBy] : undefined;
    const existingSortByIdx = sortBy?.findIndex((option) => option.displayName === timeFieldName);
    if (sortBy && existingSortByIdx !== undefined && existingSortByIdx !== -1) {
      sortBy[existingSortByIdx] = newSortBy;
    } else {
      sortBy = [{ ...newSortBy }, ...(sortBy ?? [])];
    }

    return { ...pendingOptions, sortBy };
  }

  return pendingOptions;
};
