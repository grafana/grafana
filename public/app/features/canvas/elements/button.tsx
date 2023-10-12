import { css } from '@emotion/css';
import React, { PureComponent } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { PluginState } from '@grafana/data/src';
import { TextDimensionMode } from '@grafana/schema';
import { Button, stylesFactory } from '@grafana/ui';
import { config } from 'app/core/config';
import { DimensionContext } from 'app/features/dimensions/context';
import { ColorDimensionEditor } from 'app/features/dimensions/editors';
import { TextDimensionEditor } from 'app/features/dimensions/editors/TextDimensionEditor';
import { APIEditor, APIEditorConfig } from 'app/plugins/panel/canvas/editor/element/APIEditor';
import { ButtonStyleConfig, ButtonStyleEditor } from 'app/plugins/panel/canvas/editor/element/ButtonStyleEditor';
import { callApi } from 'app/plugins/panel/canvas/editor/element/utils';
import { HttpRequestMethod } from 'app/plugins/panel/canvas/panelcfg.gen';

import { CanvasElementItem, CanvasElementProps, defaultLightTextColor } from '../element';
import { Align, TextConfig, TextData } from '../types';

interface ButtonData extends Omit<TextData, 'valign'> {
  api?: APIEditorConfig;
  style?: ButtonStyleConfig;
}

interface ButtonConfig extends Omit<TextConfig, 'valign'> {
  api?: APIEditorConfig;
  style?: ButtonStyleConfig;
}

export const defaultApiConfig: APIEditorConfig = {
  endpoint: '',
  method: HttpRequestMethod.POST,
  data: '{}',
  contentType: 'application/json',
  queryParams: [],
  headerParams: [],
};

export const defaultStyleConfig: ButtonStyleConfig = {
  variant: 'primary',
};

class ButtonDisplay extends PureComponent<CanvasElementProps<ButtonConfig, ButtonData>> {
  render() {
    const { data } = this.props;
    const styles = getStyles(config.theme2, data);

    const onClick = () => {
      if (data?.api && data?.api?.endpoint) {
        callApi(data.api);
      }
    };

    return (
      <Button type="submit" variant={data?.style?.variant} onClick={onClick} className={styles.button}>
        {data?.text}
      </Button>
    );
  }
}

const getStyles = stylesFactory((theme: GrafanaTheme2, data: ButtonData | undefined) => ({
  button: css({
    height: '100%',
    width: '100%',
    display: 'grid',

    '> span': {
      display: 'inline-grid',
      textAlign: data?.align,
      fontSize: `${data?.size}px`,
      color: data?.color,
    },
  }),
}));

export const buttonItem: CanvasElementItem<ButtonConfig, ButtonData> = {
  id: 'button',
  name: 'Button',
  description: 'Button',
  state: PluginState.alpha,

  standardEditorConfig: {
    background: false,
  },

  display: ButtonDisplay,

  defaultSize: {
    width: 150,
    height: 45,
  },

  getNewOptions: (options) => ({
    ...options,
    config: {
      text: {
        mode: TextDimensionMode.Fixed,
        fixed: 'Button',
      },
      align: Align.Center,
      color: {
        fixed: defaultLightTextColor,
      },
      size: 14,
      api: defaultApiConfig,
      style: defaultStyleConfig,
    },
    background: {
      color: {
        fixed: 'transparent',
      },
    },
    placement: {
      width: options?.placement?.width ?? 32,
      height: options?.placement?.height ?? 78,
      top: options?.placement?.top ?? 100,
      left: options?.placement?.left ?? 100,
    },
  }),

  // Called when data changes
  prepareData: (ctx: DimensionContext, cfg: ButtonConfig) => {
    const getCfgApi = () => {
      if (cfg?.api) {
        cfg.api = {
          ...cfg.api,
          method: cfg.api.method ?? defaultApiConfig.method,
          contentType: cfg.api.contentType ?? defaultApiConfig.contentType,
        };
        return cfg.api;
      }

      return undefined;
    };

    const data: ButtonData = {
      text: cfg?.text ? ctx.getText(cfg.text).value() : '',
      align: cfg.align ?? Align.Center,
      size: cfg.size,
      api: getCfgApi(),
      style: cfg?.style ?? defaultStyleConfig,
    };

    if (cfg.color) {
      data.color = ctx.getColor(cfg.color).value();
    }

    return data;
  },

  // Heatmap overlay options
  registerOptionsUI: (builder) => {
    const category = ['Button'];
    builder
      .addCustomEditor({
        category,
        id: 'styleSelector',
        path: 'config.style',
        name: 'Style',
        editor: ButtonStyleEditor,
      })
      .addCustomEditor({
        category,
        id: 'textSelector',
        path: 'config.text',
        name: 'Text',
        editor: TextDimensionEditor,
      })
      .addCustomEditor({
        category,
        id: 'config.color',
        path: 'config.color',
        name: 'Text color',
        editor: ColorDimensionEditor,
        settings: {},
        defaultValue: {},
      })
      .addRadio({
        category,
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
      .addNumberInput({
        category,
        path: 'config.size',
        name: 'Text size',
        settings: {
          placeholder: 'Auto',
        },
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
