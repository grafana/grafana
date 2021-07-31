import React, { PureComponent } from 'react';

import { CanvasSceneContext, CanvasElementItem, CanvasElementProps, LineConfig } from '../base';
import { config } from '@grafana/runtime';
import SVG from 'react-inlinesvg';
import { ColorDimensionConfig } from '../../geomap/dims/types';
import { ColorDimensionEditor } from '../../geomap/dims/editors/ColorDimensionEditor';
import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import { stylesFactory } from '@grafana/ui';

interface IconConfig {
  path?: string;
  fill?: ColorDimensionConfig;
  stroke?: LineConfig;
}

interface IconData {
  fill: string;
  strokeColor?: string;
  stroke?: number;
}

class IconDisplay extends PureComponent<CanvasElementProps<IconConfig, IconData>> {
  iconRoot = (window as any).__grafana_public_path__ + 'img/icons/unicons/';
  styles = getStyles(config.theme2);

  render() {
    const { config, width, height, data } = this.props;
    let path = config?.path ?? 'question-circle.svg';
    if (path.indexOf(':/') < 0) {
      path = this.iconRoot + path;
    }

    console.log('SVG', data);
    return <SVG src={path} width={width} height={height} />;
  }
}

export const iconItem: CanvasElementItem<IconConfig, IconData> = {
  id: 'icon',
  name: 'Icon',
  description: 'SVG Icon display',

  display: IconDisplay,

  defaultOptions: {
    path: 'question-circle.svg',
    fill: { fixed: '#F00' },
  },

  defaultSize: {
    width: 75,
    height: 75,
  },

  // Called when data changes
  prepareData: (ctx: CanvasSceneContext, cfg: IconConfig) => {
    const data: IconData = {
      fill: ctx.getColor(cfg.fill ?? { fixed: '#CCC' }).value(),
    };

    if (cfg.stroke?.width && cfg.stroke.color) {
      data.stroke = cfg.stroke?.width;
      data.strokeColor = ctx.getColor(cfg.stroke.color).value();
    }
    return data;
  },

  // Heatmap overlay options
  registerOptionsUI: (builder) => {
    builder
      .addTextInput({
        path: 'config.path',
        name: 'SVG Path (TODO, selector)',
      })
      .addCustomEditor({
        id: 'config.fill',
        path: 'config.fill',
        name: 'Icon fill color',
        editor: ColorDimensionEditor,
        settings: {},
        defaultValue: {
          // Configured values
          fixed: 'grey',
        },
      });
  },
};

const getStyles = stylesFactory((theme: GrafanaTheme2) => ({
  wrap: css`
    border: 1px solid pink;
  `,
  over: css`
    position: absolute;
    border: 2px solid red;
    left: 4px;
    top: 4px;
  `,
}));
