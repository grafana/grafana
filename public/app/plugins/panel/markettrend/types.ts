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

export enum MovementMode {
  'Solid' = 'solid',
  'Hollow' = 'hollow',
}

interface SemanticFieldMap {
  [semanticName: string]: string;
}

export interface MarketTrendColors {
  up: string;
  down: string;
  flat: string;
}

export const defaultColors: MarketTrendColors = {
  up: 'green',
  down: 'red',
  flat: 'gray',
};

export interface MarketOptions extends OptionsWithLegend, OptionsWithTooltip {
  mode: MarketTrendMode;
  priceStyle: PriceDrawStyle;
  movementMode: MovementMode;
  fields: SemanticFieldMap;
  colors: MarketTrendColors;
}
