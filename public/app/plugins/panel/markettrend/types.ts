import { OptionsWithLegend, OptionsWithTooltip } from '@grafana/schema';

export enum MarketTrendMode {
  'Price' = 'price',
  'Volume' = 'volume',
  'PriceVolume' = 'pricevolume',
}

export enum PriceDrawStyle {
  'Candles' = 'candles',
  'Bars' = 'bars',
}

export enum MovementCalc {
  'Inter' = 'inter',
  'Intra' = 'intra',
}

interface SemanticFieldMap {
  [semanticName: string]: string;
}

export interface MarketOptions extends OptionsWithLegend, OptionsWithTooltip {
  mode: MarketTrendMode;
  priceStyle: PriceDrawStyle;
  fields: SemanticFieldMap;
  upColor: string;
  downColor: string;
  flatColor: string;
  fillMode: MovementCalc;
  strokeMode: MovementCalc;
}
