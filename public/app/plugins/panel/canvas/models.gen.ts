//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// NOTE: This file will be auto generated from models.cue
// It is currenty hand written but will serve as the target for cuetsy
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

import { CanvasFrameOptions, DEFAULT_CANVAS_ELEMENT_CONFIG } from 'app/features/canvas';

export const modelVersion = Object.freeze([1, 0]);

export interface PanelOptions {
  inlineEditing: boolean;
  showAdvancedTypes: boolean;
  root: CanvasFrameOptions;
}

export const defaultPanelOptions: PanelOptions = {
  inlineEditing: true,
  showAdvancedTypes: false,
  root: {
    elements: [
      {
        ...DEFAULT_CANVAS_ELEMENT_CONFIG,
      },
    ],
  } as unknown as CanvasFrameOptions,
};
