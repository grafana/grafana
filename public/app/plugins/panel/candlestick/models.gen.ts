//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// NOTE: This file will be auto generated from models.cue
// It is currenty hand written but will serve as the target for cuetsy
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

import { LegendDisplayMode, OptionsWithLegend } from '@grafana/schema';

export const modelVersion = Object.freeze([1, 0]);

export enum VizDisplayMode {
  ValueVolume = 'value+volume',
  Value = 'value',
  Volume = 'volume',
}

export enum ValueStyle {
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
  valueStyle: ValueStyle;
  colorStrategy: ColorStrategy;
  fields: CandlestickFieldMap;
  colors: CandlestickColors;
}

export const defaultPanelOptions: CandlestickOptions = {
  mode: VizDisplayMode.ValueVolume,
  valueStyle: ValueStyle.Candles,
  colorStrategy: ColorStrategy.Intra,
  colors: defaultColors,
  fields: {},
  legend: {
    displayMode: LegendDisplayMode.List,
    placement: 'bottom',
    calcs: [],
  },
};
