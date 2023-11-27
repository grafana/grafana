/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions */

import { ExtendedColumn } from '../Table.types';

export interface FilterProps<T> {
  columns: Array<ExtendedColumn<any>>;
  rawData: T[];
  setFilteredData: (data: T[]) => void;
  hasBackendFiltering?: boolean;
  tableKey?: string;
  onFilterStateChange?: (isActive: boolean) => void;
}

// prevent additional usage of "any"
export type FilterFormValues = Record<string, any>;
