import * as raw from '../common/common.gen';

import { MatcherConfig } from './dashboard.types';

export interface MapLayerOptions<TConfig = any> extends raw.MapLayerOptions {
  // Custom options depending on the type
  config?: TConfig;
  filterData?: MatcherConfig;
}

export interface DataQuery extends raw.DataQuery {
  /**
   * Unique, guid like, string (used only in explore mode)
   */
  key?: string;

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

// TODO remove when https://github.com/grafana/cuetsy/issues/74 is fixed
export const defaultTableFieldOptions: raw.TableFieldOptions = {
  align: 'auto',
  inspect: false,
  cellOptions: {
    type: raw.TableCellDisplayMode.Auto,
  },
};
