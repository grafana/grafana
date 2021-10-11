//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// NOTE: This file will be auto generated from models.cue
// It is currenty hand written but will serve as the target for cuetsy
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

import { CanvasElementOptions } from 'app/features/canvas';
import { IconConfig } from 'app/features/canvas/elements/icon';

export interface PanelOptions {
  root: Omit<CanvasElementOptions<IconConfig>, 'type'>; // type is forced
}

export const defaultPanelOptions: PanelOptions = {
  root: {
    config: {},
  },
};
