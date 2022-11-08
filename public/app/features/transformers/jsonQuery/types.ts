import { FieldType } from '@grafana/data';

export interface JSONQueryOptions {
  source?: string;
  query?: string;
  type?: FieldType;
  alias?: string;
}

export interface JSONPathPlusReturn {
  path: string;
  value: unknown;
  parent: object;
  parentProperty: string;
  hasArrExpr: boolean;
  pointer: string;
}
