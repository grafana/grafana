import * as raw from '../common/common.gen';

import { MatcherConfig } from './dashboard.types';

export interface MapLayerOptions<TConfig = any> extends raw.MapLayerOptions {
  // Custom options depending on the type
  config?: TConfig;
  filterData?: MatcherConfig;
}

export interface DataQuery extends raw.DataQuery {
  // TODO remove explicit nulls
  datasource?: raw.DataSourceRef | null;
}
export interface BaseDimensionConfig<T = string | number> extends Omit<raw.BaseDimensionConfig, 'fixed'> {
  fixed: T;
}

export interface ScaleDimensionConfig extends BaseDimensionConfig<number>, Omit<raw.ScaleDimensionConfig, 'fixed'> {}

export interface TextDimensionConfig extends BaseDimensionConfig<string>, Omit<raw.TextDimensionConfig, 'fixed'> {}

export interface ColorDimensionConfig extends BaseDimensionConfig<string>, Omit<raw.ColorDimensionConfig, 'fixed'> {}

export * from '../common/common.gen';
