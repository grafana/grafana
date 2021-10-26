import { OptionsWithLegend, OptionsWithTooltip } from '@grafana/schema';

export enum MarketTrendMode {
  'Price' = 'Price',
  'Volume' = 'volume',
}

export enum PriceDrawStyle {
  'Candles' = 'candles',
  'Bars' = 'bars',
}

export interface MarketOptions extends OptionsWithLegend, OptionsWithTooltip {
  mode: MarketTrendMode;
  drawStyle: PriceDrawStyle;
}
