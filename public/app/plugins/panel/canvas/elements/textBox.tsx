import React, { PureComponent, CSSProperties } from 'react';

import { CanvasElementItem, CanvasElementProps, LineConfig } from '../base';
import { config } from '@grafana/runtime';
import SVG from 'react-inlinesvg';
import { ColorDimensionConfig } from '../../geomap/dims/types';

interface TextBoxConfig {
  text?: string; // could be parent config?
}

class TextBoxDisplay extends PureComponent<CanvasElementProps<TextBoxConfig>> {
  render() {
    return <div>TODO... import Text panel options?</div>;
  }
}

export const textBoxItem: CanvasElementItem<TextBoxConfig> = {
  id: 'text-box',
  name: 'Text',
  description: 'Text box',

  display: TextBoxDisplay,

  defaultOptions: {
    path: 'question-circle.svg',
    fill: { fixed: '#F00' },
  },

  defaultSize: {
    width: 240,
    height: 160,
  },
};
