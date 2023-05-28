import React, { PureComponent } from 'react';

import { PluginState } from '@grafana/data/src';
import { TextDimensionConfig } from '@grafana/schema';
import { Button } from '@grafana/ui';
import { DimensionContext } from 'app/features/dimensions/context';
import { TextDimensionEditor } from 'app/features/dimensions/editors/TextDimensionEditor';
import { APIEditor, APIEditorConfig, callApi } from 'app/plugins/panel/canvas/editor/element/APIEditor';

import { CanvasElementItem, CanvasElementProps, defaultBgColor } from '../element';

interface ButtonData {
  text?: string;
  api?: APIEditorConfig;
}

interface ButtonConfig {
  text?: TextDimensionConfig;
  api?: APIEditorConfig;
}

class ButtonDisplay extends PureComponent<CanvasElementProps<ButtonConfig, ButtonData>> {
  render() {
    const { data } = this.props;
    const onClick = () => {
      if (data?.api) {
        callApi(data.api);
      }
    };

    return (
      <Button type="submit" onClick={onClick} style={{ background: defaultBgColor }}>
        {data?.text}
      </Button>
    );
  }
}

export const buttonItem: CanvasElementItem<ButtonConfig, ButtonData> = {
  id: 'button',
  name: 'Button',
  description: 'Button',
  state: PluginState.alpha,

  display: ButtonDisplay,

  defaultSize: {
    width: 32,
    height: 32,
  },

  getNewOptions: (options) => ({
    ...options,
    background: {
      color: {
        fixed: 'transparent',
      },
    },
    placement: {
      width: 32,
      height: 32,
      top: 0,
      left: 0,
    },
  }),

  // Called when data changes
  prepareData: (ctx: DimensionContext, cfg: ButtonConfig) => {
    const data: ButtonData = {
      text: cfg?.text ? ctx.getText(cfg.text).value() : '',
      api: cfg?.api ?? undefined,
    };

    return data;
  },

  // Heatmap overlay options
  registerOptionsUI: (builder) => {
    const category = ['Button'];
    builder
      .addCustomEditor({
        category,
        id: 'textSelector',
        path: 'config.text',
        name: 'Text',
        editor: TextDimensionEditor,
      })
      .addCustomEditor({
        category,
        id: 'apiSelector',
        path: 'config.api',
        name: 'API',
        editor: APIEditor,
      });
  },
};
