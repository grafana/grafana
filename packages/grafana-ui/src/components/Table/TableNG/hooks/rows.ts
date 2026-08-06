import { useMemo, useState } from 'react';

import { createDataFrame, type DataFrame, type Field } from '@grafana/data';
import { type SortColumn } from '@grafana/react-data-grid';

import { type FilterType, type NestedRowEntry, type TableRow } from '../types';
import { getColumnTypes, getDisplayName } from '../utils/fields';
import { applyFilter } from '../utils/filter';
import { compileFrameToRecords } from '../utils/rows';
import { applySort } from '../utils/sort';

export function useFilteredRows(rows: TableRow[], fields: Field[], hasNestedFrames?: boolean) {
  const [filter, setFilter] = useState<FilterType>({});
  const filterResult = useMemo(
    () => applyFilter(rows, filter, fields, hasNestedFrames),
    [rows, filter, fields, hasNestedFrames]
  );
  return { rows: filterResult.filteredRows, filter, setFilter, filterResult };
}

export const useRowCompiler = (dataFrame: DataFrame, nestedFramesFieldName?: string) => {
  const orderedFieldNames = useMemo(() => dataFrame.fields.map(getDisplayName), [dataFrame]);
  const stringified = useMemo(() => JSON.stringify(orderedFieldNames), [orderedFieldNames]);
  return useMemo(
    () => compileFrameToRecords(orderedFieldNames, nestedFramesFieldName),
    [stringified, nestedFramesFieldName] // eslint-disable-line react-hooks/exhaustive-deps
  );
};

export const useNestedRows = (
  rows: TableRow[],
  nestedData: DataFrame[] | undefined,
  hasNestedFrames: boolean,
  nestedFramesFieldName: string | undefined,
  filter: FilterType,
  sortColumns: SortColumn[]
): NestedRowEntry[] => {
  const frameToRecords = useRowCompiler(nestedData?.[0] ?? createDataFrame({ fields: [] }));

  return useMemo(() => {
    const result: NestedRowEntry[] = [];
    if (!hasNestedFrames || !nestedFramesFieldName || !frameToRecords || !nestedData) {
      return result;
    }

    for (const parentRow of rows) {
      // Type guard to check if data exists as it's optional
      const nestedFrame = nestedData[parentRow.__index];
      if (!nestedFrame) {
        continue;
      }

      const rawRows = frameToRecords(nestedFrame, parentRow.__index);
      const filterResult = applyFilter(rawRows, filter, nestedFrame.fields, false, parentRow.__index);
      const sortedRows = applySort(
        filterResult.filteredRows,
        nestedFrame.fields,
        sortColumns,
        getColumnTypes(nestedFrame.fields)
      );
      result[parentRow.__index] = { raw: rawRows, final: sortedRows, filterResult };
    }

    return result;
  }, [hasNestedFrames, nestedFramesFieldName, rows, sortColumns, filter, frameToRecords, nestedData]);
};
