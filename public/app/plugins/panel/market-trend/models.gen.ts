//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// NOTE: This file will be auto generated from models.cue
// It is currenty hand written but will serve as the target for cuetsy
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

import { LegendDisplayMode, OptionsWithLegend } from '@grafana/schema';

export const modelVersion = Object.freeze([1, 0]);

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

export interface CandlestickFieldMap {
  open?: string;
  high?: string;
  low?: string;
  close?: string;
  volume?: string;
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

export interface MarketOptions extends OptionsWithLegend {
  mode: MarketTrendMode;
  priceStyle: PriceStyle;
  colorStrategy: ColorStrategy;
  fields: CandlestickFieldMap;
  colors: MarketTrendColors;
}

export const defaultPanelOptions: MarketOptions = {
  mode: MarketTrendMode.PriceVolume,
  priceStyle: PriceStyle.Candles,
  colorStrategy: ColorStrategy.Intra,
  colors: defaultColors,
  fields: {},
  legend: {
    displayMode: LegendDisplayMode.List,
    placement: 'bottom',
    calcs: [],
  },
};
