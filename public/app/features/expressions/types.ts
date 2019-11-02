import { DataQuery } from '@grafana/data';

export enum GELQueryType {
  math = 'math',
  reduce = 'reduce',
  resample = 'resample',
}

/**
 * For now this is a single object to cover all the types.... would likely
 * want to split this up by type as the complexity increases
 */
export interface ExpressionQuery extends DataQuery {
  type: GELQueryType;
  reducer?: string;
  expression?: string;
  rule?: string;
  downsampler?: string;
  upsampler?: string;
}
