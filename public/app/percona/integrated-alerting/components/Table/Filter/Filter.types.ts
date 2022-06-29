import { ExtendedColumn } from '../Table.types';

export interface FilterProps {
  columns: Array<ExtendedColumn<any>>;
  rawData: Object[];
  setFilteredData: (data: Object[]) => void;
}
