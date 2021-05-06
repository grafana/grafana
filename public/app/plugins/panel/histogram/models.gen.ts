//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// NOTE: This file will be auto generated from models.cue
// It is currenty hand written but will serve as the target for cuetsy
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

import { GraphGradientMode } from '@grafana/ui';

export const modelVersion = Object.freeze([1, 0]);

export interface PanelOptions {
  bucketSize?: number;
}

export const defaultPanelOptions: PanelOptions = {};

/**
 * @alpha
 */
export interface PanelFieldConfig {
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
