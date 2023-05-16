//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// NOTE: This file will be auto generated from models.cue
// It is currenty hand written but will serve as the target for cuetsy
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

import { CanvasElementOptions } from 'app/features/canvas';
import { IconConfig } from 'app/features/canvas/elements/icon';
import { ResourceDimensionMode } from '@grafana/schema';

export interface Options {
  root: Omit<CanvasElementOptions<IconConfig>, 'type' | 'name'>; // type is forced
}

export const defaultOptions: Options = {
  root: {
    config: {
      path: {
        mode: ResourceDimensionMode.Fixed,
        fixed: 'img/icons/unicons/analysis.svg',
      },
      fill: {
        fixed: 'green'
      }
    },
  },
};
