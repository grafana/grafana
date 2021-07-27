import React, { PureComponent } from 'react';

import { CanvasElementItem, CanvasElementProps } from '../base';

interface TextBoxConfig {
  text?: string; // could be parent config?
}

class TextBoxDisplay extends PureComponent<CanvasElementProps<TextBoxConfig>> {
  render() {
    const { config } = this.props;
    return <div>TEXT: {config.text}</div>;
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

  // Heatmap overlay options
  registerOptionsUI: (builder) => {
    builder.addTextInput({
      path: 'config.text',
      name: 'Text',
    });
  },
};
