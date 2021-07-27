//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// NOTE: This file will be auto generated from models.cue
// It is currenty hand written but will serve as the target for cuetsy
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

import { CanvasLayerOptions } from './base';
import { DEFAULT_ELEMENT_CONFIG } from './elements/registry';

export const modelVersion = Object.freeze([1, 0]);

export interface PanelOptions {
  root: CanvasLayerOptions;
}

export const defaultPanelOptions: PanelOptions = {
  root: ({
    elements: [
      {
        ...DEFAULT_ELEMENT_CONFIG,
      },
    ],
  } as unknown) as CanvasLayerOptions,
};
