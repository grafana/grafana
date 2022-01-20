//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// NOTE: This file will be auto generated from models.cue
// It is currenty hand written but will serve as the target for cuetsy
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

import {
  HideableFieldConfig,
  LegendDisplayMode,
  OptionsWithLegend,
  OptionsWithTooltip,
  SortOrder,
  TooltipDisplayMode,
} from '@grafana/schema';
import { HeatmapCalculationOptions } from 'app/core/components/TransformersUI/calculateHeatmap/types';

export const modelVersion = Object.freeze([1, 0]);

export enum HeatmapSourceMode {
  Auto = 'auto',
  Calculate = 'calculate',
  Data = 'data',
}

export interface PanelOptions extends OptionsWithLegend, OptionsWithTooltip {
  source: HeatmapSourceMode;

  heatmap?: HeatmapCalculationOptions;

  // cards: {
  //   cardPadding: null,
  //   cardRound: null,
  // },
  // color: {
  //   mode: 'spectrum',
  //   cardColor: '#b4ff00',
  //   colorScale: 'sqrt',
  //   exponent: 0.5,
  //   colorScheme: 'interpolateOranges',
  // },

  hideZeroBuckets?: boolean;
  reverseYBuckets?: boolean;
}

export const defaultPanelOptions: PanelOptions = {
  source: HeatmapSourceMode.Auto,
  legend: {
    displayMode: LegendDisplayMode.Hidden,
    placement: 'bottom',
    calcs: [],
  },
  tooltip: {
    mode: TooltipDisplayMode.Multi,
    sort: SortOrder.None,
  },
};

export interface PanelFieldConfig extends HideableFieldConfig {
  // TODO points vs lines
}

export const defaultPanelFieldConfig: PanelFieldConfig = {
  // default to points?
};
