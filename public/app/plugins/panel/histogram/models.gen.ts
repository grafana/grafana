//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// NOTE: This file will be auto generated from models.cue
// It is currenty hand written but will serve as the target for cuetsy
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

import {
  LegendDisplayMode,
  OptionsWithLegend,
  OptionsWithTooltip,
  TooltipDisplayMode,
  GraphGradientMode,
  HideableFieldConfig,
  SortOrder,
} from '@grafana/schema';

export const modelVersion = Object.freeze([1, 0]);

export interface PanelOptions extends OptionsWithLegend, OptionsWithTooltip {
  bucketSize?: number;
  bucketOffset?: number;
  combine?: boolean;
}

export const defaultPanelOptions: PanelOptions = {
  bucketOffset: 0,
  legend: {
    displayMode: LegendDisplayMode.List,
    placement: 'bottom',
    calcs: [],
  },
  tooltip: {
    mode: TooltipDisplayMode.Multi,
    sort: SortOrder.None,
  },
};

/**
 * @alpha
 */
export interface PanelFieldConfig extends HideableFieldConfig {
  lineWidth?: number; // 0
  fillOpacity?: number; // 100
  gradientMode?: GraphGradientMode;
}

/**
 * @alpha
 */
export const defaultPanelFieldConfig: PanelFieldConfig = {
  lineWidth: 1,
  fillOpacity: 80,
  //gradientMode: GraphGradientMode.None,
};
