import React, { PureComponent } from 'react';

import { CanvasElementItem, CanvasElementProps } from '../base';

export enum Align {
  Left = 'left',
  Center = 'center',
  Right = 'right',
}

export enum VAlign {
  Top = 'top',
  Middle = 'middle',
  Bottom = 'bottom',
}

interface TextBoxConfig {
  text?: string; // could be parent config?
  size?: number; // 0 or missing will "auto size"
  align: Align;
  valign: VAlign;
}

class TextBoxDisplay extends PureComponent<CanvasElementProps<TextBoxConfig>> {
  render() {
    const { config } = this.props;
    return <div>{JSON.stringify(config, null, 2)}</div>;
  }
}

export const textBoxItem: CanvasElementItem<TextBoxConfig> = {
  id: 'text-box',
  name: 'Text',
  description: 'Text box',

  display: TextBoxDisplay,

  defaultOptions: {
    align: Align.Left,
    valign: VAlign.Middle,
  },

  defaultSize: {
    width: 240,
    height: 160,
  },

  // Heatmap overlay options
  registerOptionsUI: (builder) => {
    builder
      .addTextInput({
        path: 'config.text',
        name: 'Text',
      })
      .addRadio({
        path: 'config.align',
        name: 'Align text',
        settings: {
          options: [
            { value: Align.Left, label: 'Left' },
            { value: Align.Center, label: 'Center' },
            { value: Align.Right, label: 'Right' },
          ],
        },
        defaultValue: Align.Left,
      })
      .addRadio({
        path: 'config.valign',
        name: 'Vertical align',
        settings: {
          options: [
            { value: VAlign.Top, label: 'Top' },
            { value: VAlign.Middle, label: 'Middle' },
            { value: VAlign.Bottom, label: 'Bottom' },
          ],
        },
        defaultValue: VAlign.Middle,
      })
      .addNumberInput({
        path: 'config.size',
        name: 'Text size',
        settings: {
          placeholder: 'Auto',
        },
      });
  },
};
