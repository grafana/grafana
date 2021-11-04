import { TimeSeriesOptions } from '../timeseries/types';

export enum MarketTrendMode {
  Price = 'price',
  Volume = 'volume',
  PriceVolume = 'pricevolume',
}

export enum PriceStyle {
  Candles = 'candles',
  OHLCBars = 'ohlcbars',
}

export enum ColorStrategy {
  // up/down color depends on current close vs current open
  // filled always
  Intra = 'intra',
  // up/down color depends on current close vs prior close
  // filled/hollow depends on current close vs current open
  Inter = 'inter',
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

export interface MarketOptions extends TimeSeriesOptions {
  mode: MarketTrendMode;
  priceStyle: PriceStyle;
  colorStrategy: ColorStrategy;
  fieldMap: SemanticFieldMap;
  colors: MarketTrendColors;
}
