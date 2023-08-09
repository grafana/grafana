import { css } from '@emotion/css';
import React, { PureComponent } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { stylesFactory } from '@grafana/ui';
import { config } from 'app/core/config';
import { DimensionContext } from 'app/features/dimensions/context';
import { ColorDimensionEditor } from 'app/features/dimensions/editors/ColorDimensionEditor';

import { CanvasElementItem, CanvasElementProps, defaultBgColor } from '../element';
import { LineConfig, LineData } from '../types';

class LineDisplay extends PureComponent<CanvasElementProps<LineConfig, LineData>> {
  render() {
    const { data } = this.props;
    const styles = getStyles(config.theme2, data);
    return <div className={styles.container} />;
  }
}

const getStyles = stylesFactory((theme: GrafanaTheme2, data) => ({
  container: css`
    position: absolute;
    width: 100%;
    display: table;
    height: ${data?.width}px;
    background-color: ${data?.color};
    top: 50%;
    transform: translateY(-50%);
  `,
}));

export const lineItem: CanvasElementItem<LineConfig, LineData> = {
  id: 'line',
  name: 'Line',
  description: 'Line',

  display: LineDisplay,

  defaultSize: {
    width: 200,
    height: 3,
  },

  getNewOptions: (options) => ({
    ...options,
    config: {
      color: {
        fixed: defaultBgColor,
      },
      width: 3,
    },
    background: {
      color: {
        fixed: 'transparent',
      },
    },
  }),

  // Called when data changes
  prepareData: (ctx: DimensionContext, cfg: LineConfig) => {
    const data: LineData = {
      width: cfg.width,
    };

    if (cfg.color) {
      data.color = ctx.getColor(cfg.color).value();
    }

    return data;
  },

  registerOptionsUI: (builder) => {
    const category = ['Line'];
    builder
      .addCustomEditor({
        category,
        id: 'config.color',
        path: 'config.color',
        name: 'Line color',
        editor: ColorDimensionEditor,
        settings: {},
        defaultValue: {},
      })
      .addNumberInput({
        category,
        path: 'config.width',
        name: 'Line width',
        settings: {
          placeholder: 'Auto',
        },
      });
  },
};
