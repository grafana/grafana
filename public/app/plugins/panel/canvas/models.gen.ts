//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// NOTE: This file will be auto generated from models.cue
// It is currenty hand written but will serve as the target for cuetsy
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

import { CanvasGroupOptions, DEFAULT_CANVAS_ELEMENT_CONFIG } from 'app/features/canvas';

export const modelVersion = Object.freeze([1, 0]);

export interface PanelOptions {
  root: CanvasGroupOptions;
}

export const defaultPanelOptions: PanelOptions = {
  root: ({
    elements: [
      {
        ...DEFAULT_CANVAS_ELEMENT_CONFIG,
      },
    ],
  } as unknown) as CanvasGroupOptions,
};
