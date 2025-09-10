import { DataFrame, FieldType } from '@grafana/data';

export interface TableRow {
  // Required metadata properties
  __depth: number;
  __index: number;

  // Nested table properties
  data?: DataFrame;
  __nestedFrames?: DataFrame[];
  __expanded?: boolean; // For row expansion state

  // Generic typing for column values
  [columnName: string]: unknown;
}

export interface TableSummaryRow {
  [columnName: string]: string | number | undefined;
}

// Comparator for sorting table values
export type Comparator = (a: unknown, b: unknown) => number;

// Type for mapping column names to their field types
export type ColumnTypes = Record<string, FieldType>;
