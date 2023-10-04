import { css } from '@emotion/css';
import React, { PureComponent } from 'react';

import { GrafanaTheme2, PluginState } from '@grafana/data/src';
import { ColorDimensionConfig, TextDimensionConfig, TextDimensionMode } from '@grafana/schema';
import { Button, stylesFactory } from '@grafana/ui';
import { config } from 'app/core/config';
import { DimensionContext } from 'app/features/dimensions/context';
import { ColorDimensionEditor } from 'app/features/dimensions/editors';
import { TextDimensionEditor } from 'app/features/dimensions/editors/TextDimensionEditor';
import { APIEditor, APIEditorConfig } from 'app/plugins/panel/canvas/editor/element/APIEditor';
import { ButtonStyleConfig, ButtonStyleEditor } from 'app/plugins/panel/canvas/editor/element/ButtonStyleEditor';
import { callApi } from 'app/plugins/panel/canvas/editor/element/utils';
import { HttpRequestMethod } from 'app/plugins/panel/canvas/panelcfg.gen';

import { CanvasElementItem, CanvasElementProps } from '../element';

interface ButtonData {
  text?: string;
  api?: APIEditorConfig;
  style?: ButtonStyleConfig;
  borderColor?: string;
  borderWidth?: number;
}

interface ButtonConfig {
  text?: TextDimensionConfig;
  api?: APIEditorConfig;
  style?: ButtonStyleConfig;
  borderColor?: ColorDimensionConfig;
  borderWidth?: number;
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

export const defaultBorderWidth = 0;

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
      <Button className={styles.container} type="submit" variant={data?.style?.variant} onClick={onClick}>
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
    width: 78,
    height: 32,
  },

  getNewOptions: (options) => {
    return {
      ...options,
      config: {
        text: {
          mode: TextDimensionMode.Fixed,
          fixed: 'Button',
        },
        api: defaultApiConfig,
        style: defaultStyleConfig,
        borderColor: {
          fixed: 'text',
        },
        borderWidth: defaultBorderWidth,
      },
      background: {
        color: {
          fixed: 'transparent',
        },
      },
      placement: {
        width: options?.placement?.width,
        height: options?.placement?.height,
        top: options?.placement?.top ?? 100,
        left: options?.placement?.left ?? 100,
      },
    };
  },

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
      api: getCfgApi(),
      style: cfg?.style ?? defaultStyleConfig,
      borderWidth: cfg.borderWidth,
    };

    if (cfg.borderColor) {
      data.borderColor = ctx.getColor(cfg.borderColor).value();
    }

    return data;
  },

  // Button options
  registerOptionsUI: (builder, ctx) => {
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
        id: 'styleSelector',
        path: 'config.style',
        name: 'Style',
        editor: ButtonStyleEditor,
      })
      .addNumberInput({
        category,
        path: 'config.borderWidth',
        name: 'Button border width',
        settings: {
          placeholder: '0',
        },
      });
    if (ctx.options?.config?.borderWidth) {
      builder.addCustomEditor({
        category,
        id: 'config.borderColor',
        path: 'config.borderColor',
        name: 'Button border color',
        editor: ColorDimensionEditor,
        settings: {},
        defaultValue: {},
      });
    }
    builder.addCustomEditor({
      category,
      id: 'apiSelector',
      path: 'config.api',
      name: 'API',
      editor: APIEditor,
    });
  },
};

const getStyles = stylesFactory((theme: GrafanaTheme2, data) => ({
  container: css`
    background-color: ${data?.backgroundColor};
    border: ${data?.borderWidth}px solid ${data?.borderColor};
  `,
}));
