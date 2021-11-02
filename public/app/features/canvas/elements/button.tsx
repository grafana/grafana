import React, { PureComponent } from 'react';
import { Button } from '@grafana/ui';

import { DimensionContext } from 'app/features/dimensions/context';
import { TextDimensionEditor } from 'app/features/dimensions/editors/TextDimensionEditor';
import { TextDimensionConfig } from 'app/features/dimensions/types';
import { CanvasElementItem, CanvasElementProps } from '../element';

interface ButtonData {
  text?: string;
}

interface ButtonConfig {
  text?: TextDimensionConfig;
}

class ButtonDisplay extends PureComponent<CanvasElementProps<ButtonConfig, ButtonData>> {
  render() {
    const { data } = this.props;
    const onClick = () => console.log('button being clicked :)');

    return <Button onClick={onClick}>{data?.text}</Button>;
  }
}

export const buttonItem: CanvasElementItem<ButtonConfig, ButtonData> = {
  id: 'button',
  name: 'Button',
  description: 'Button',

  display: ButtonDisplay,

  defaultSize: {
    width: 200,
    height: 50,
  },

  getNewOptions: (options) => ({
    ...options,
  }),

  // Called when data changes
  prepareData: (ctx: DimensionContext, cfg: ButtonConfig) => {
    const data: ButtonData = {
      text: cfg?.text ? ctx.getText(cfg.text).value() : '',
    };

    return data;
  },

  // Heatmap overlay options
  registerOptionsUI: (builder) => {
    const category = ['Button'];
    builder.addCustomEditor({
      category,
      id: 'textSelector',
      path: 'config.text',
      name: 'Text',
      editor: TextDimensionEditor,
    });
  },
};
