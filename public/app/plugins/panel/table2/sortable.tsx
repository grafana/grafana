// Libraries
import isNumber from 'lodash/isNumber';

import { TableData } from '@grafana/ui';

export function sortTableData(data: TableData, sortIndex?: number, reverse = false): TableData {
  if (isNumber(sortIndex)) {
    const copy = {
      ...data,
      rows: [...data.rows].sort((a, b) => {
        a = a[sortIndex];
        b = b[sortIndex];
        // Sort null or undefined separately from comparable values
        return +(a == null) - +(b == null) || +(a > b) || -(a < b);
      }),
    };

    if (reverse) {
      copy.rows.reverse();
    }

    return copy;
  }
  return data;
}
