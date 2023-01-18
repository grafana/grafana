import * as raw from '../schema/mudball.gen';

import { MatcherConfig } from './dashboard.types';

export interface MapLayerOptions<TConfig = any> extends raw.MapLayerOptions {
  // Custom options depending on the type
  config?: TConfig;
  filterData?: MatcherConfig;
}

export * from '../schema/mudball.gen';
