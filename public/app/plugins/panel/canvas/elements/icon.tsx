import React, { PureComponent, CSSProperties } from 'react';

import { CanvasElementItem, CanvasElementProps, LineConfig } from '../base';
import { config } from '@grafana/runtime';
import SVG from 'react-inlinesvg';
import { ColorDimensionConfig } from '../../geomap/dims/types';
import { ColorDimensionEditor } from '../../geomap/dims/editors/ColorDimensionEditor';
import { GrafanaTheme2 } from '../../../../../../packages/grafana-data/src';
import { css } from '@emotion/css';
import { stylesFactory } from '../../../../../../packages/grafana-ui/src';

interface IconConfig {
  path?: string;
  fill?: ColorDimensionConfig;
  stroke?: LineConfig;
}

interface State {
  working?: boolean;
  last?: any;
  color: string;
}

class IconDisplay extends PureComponent<CanvasElementProps<IconConfig>, State> {
  iconRoot = (window as any).__grafana_public_path__ + 'img/icons/unicons/';
  state: State = { color: config.theme.colors.textFaint };
  styles = getStyles(config.theme2);

  render() {
    const { config, width, height } = this.props;
    let path = config?.path ?? 'question-circle.svg';
    if (path.indexOf(':/') < 0) {
      path = this.iconRoot + path;
    }

    return <SVG src={path} width={width} height={height} />;
  }
}

export const iconItem: CanvasElementItem<IconConfig> = {
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
