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
import { HeatmapCalculationOptions } from 'app/core/components/TransformersUI/calculateHeatmap/models.gen';

export const modelVersion = Object.freeze([1, 0]);

export enum HeatmapSourceMode {
  Auto = 'auto',
  Calculate = 'calculate',
  Data = 'data', // Use the data as is
}

export interface PanelOptions extends OptionsWithLegend, OptionsWithTooltip {
  source: HeatmapSourceMode;

  heatmap?: HeatmapCalculationOptions;

  cellPadding?: number; // was cardPadding
  cellRadius?: number; // was cardRadius

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
  // TODO points vs lines etc
}

export const defaultPanelFieldConfig: PanelFieldConfig = {
  // default to points?
};
