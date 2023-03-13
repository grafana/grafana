/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions */

import { ExtendedColumn } from '../Table.types';

export interface FilterProps {
  columns: Array<ExtendedColumn<any>>;
  rawData: Object[];
  setFilteredData: (data: Object[]) => void;
  hasBackendFiltering: boolean;
  tableKey?: string;
}
