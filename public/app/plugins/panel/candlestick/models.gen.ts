import { CandlestickFieldMappings } from './types';

export interface PanelOptions {
  mode: 'ohlc' | 'candlestick' | 'volume';

  // Fields
  names: CandlestickFieldMappings; // open: "open_price"

  // Colors
  up: string;
  down: string;
}
export interface PanelFieldConfig {
  // nothing for now, extend timeseries?
}
