// Libraries
import _ from 'lodash';

import { TableData } from '@grafana/ui';

export class SortedTableData {
  rows: any[];

  constructor(private data: TableData, sortIndex?: number, reverse?: boolean) {
    if (_.isNumber(sortIndex)) {
      // Make a copy of all the rows
      this.rows = this.data.rows.map((row, index) => {
        return row;
      });
      this.rows.sort((a, b) => {
        a = a[sortIndex];
        b = b[sortIndex];
        // Sort null or undefined separately from comparable values
        return +(a == null) - +(b == null) || +(a > b) || -(a < b);
      });

      if (reverse) {
        this.rows.reverse();
      }
    } else {
      this.rows = data.rows;
    }
  }

  getInfo(): any[] {
    return this.data.columns;
  }

  getRow(index: number): any[] {
    return this.rows[index];
  }

  getCount(): number {
    return this.rows.length;
  }
}
