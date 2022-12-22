//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// NOTE: This file will be auto generated from models.cue
// It is currenty hand written but will serve as the target for cuetsy
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

import { LegendDisplayMode, OptionsWithLegend } from '@grafana/schema';

export const modelVersion = Object.freeze([1, 0]);

export enum VizDisplayMode {
  CandlesVolume = 'candles+volume',
  Candles = 'candles',
  Volume = 'volume',
}

export enum CandleStyle {
  Candles = 'candles',
  OHLCBars = 'ohlcbars',
}

export enum ColorStrategy {
  // up/down color depends on current close vs current open
  // filled always
  OpenClose = 'open-close',
  // up/down color depends on current close vs prior close
  // filled/hollow depends on current close vs current open
  CloseClose = 'close-close',
}

export interface CandlestickFieldMap {
  open?: string;
  high?: string;
  low?: string;
  close?: string;
  volume?: string;
}

export interface CandlestickColors {
  up: string;
  down: string;
  flat: string;
}

export const defaultColors: CandlestickColors = {
  up: 'green',
  down: 'red',
  flat: 'gray',
};

export interface CandlestickOptions extends OptionsWithLegend {
  mode: VizDisplayMode;
  candleStyle: CandleStyle;
  colorStrategy: ColorStrategy;
  fields: CandlestickFieldMap;
  colors: CandlestickColors;

  // When enabled, all fields will be sent to the graph
  includeAllFields?: boolean;
}

export const defaultPanelOptions: CandlestickOptions = {
  mode: VizDisplayMode.CandlesVolume,
  candleStyle: CandleStyle.Candles,
  colorStrategy: ColorStrategy.OpenClose,
  colors: defaultColors,
  fields: {},
  legend: {
    displayMode: LegendDisplayMode.List,
    showLegend: true,
    placement: 'bottom',
    calcs: [],
  },
  includeAllFields: false,
};
