import { css } from '@emotion/css';
import React, { PureComponent } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { stylesFactory } from '@grafana/ui';
import { config } from 'app/core/config';
import { DimensionContext } from 'app/features/dimensions/context';
import { ColorDimensionEditor } from 'app/features/dimensions/editors/ColorDimensionEditor';

import { CanvasElementItem, CanvasElementProps, defaultBgColor } from '../element';
import { EllipseConfig, EllipseData } from '../types';

class EllipseDisplay extends PureComponent<CanvasElementProps<EllipseConfig, EllipseData>> {
  render() {
    const { data } = this.props;
    const styles = getStyles(config.theme2, data);
    return <div className={styles.container} />;
  }
}

const getStyles = stylesFactory((theme: GrafanaTheme2, data) => ({
  container: css`
    border: ${data?.borderWidth}px solid ${data?.borderColor};
    border-radius: 50%;
    position: absolute;
    width: 100%;
    display: table;
    height: 100%;
    background-color: ${data?.backgroundColor};
    top: 50%;
    transform: translateY(-50%);
  `,
}));

export const ellipseItem: CanvasElementItem<EllipseConfig, EllipseData> = {
  id: 'ellipse',
  name: 'Ellipse',
  description: 'Ellipse',

  display: EllipseDisplay,

  defaultSize: {
    width: 200,
    height: 150,
  },

  getNewOptions: (options) => ({
    ...options,
    config: {
      backgroundColor: {
        fixed: 'transparent',
      },
      borderColor: {
        fixed: defaultBgColor,
      },
      borderWidth: 3,
    },
    background: {
      color: {
        fixed: 'transparent',
      },
    },
  }),

  // Called when data changes
  prepareData: (ctx: DimensionContext, cfg: EllipseConfig) => {
    const data: EllipseData = {
      borderWidth: cfg.borderWidth,
    };

    if (cfg.backgroundColor) {
      data.backgroundColor = ctx.getColor(cfg.backgroundColor).value();
    }
    if (cfg.borderColor) {
      data.borderColor = ctx.getColor(cfg.borderColor).value();
    }

    return data;
  },

  registerOptionsUI: (builder) => {
    const category = ['Ellipse'];
    builder
      .addCustomEditor({
        category,
        id: 'config.borderColor',
        path: 'config.borderColor',
        name: 'Ellipse border color',
        editor: ColorDimensionEditor,
        settings: {},
        defaultValue: {},
      })
      .addNumberInput({
        category,
        path: 'config.width',
        name: 'Ellipse border width',
        settings: {
          placeholder: 'Auto',
        },
      })
      .addCustomEditor({
        category,
        id: 'config.backgroundColor',
        path: 'config.backgroundColor',
        name: 'Ellipse background color',
        editor: ColorDimensionEditor,
        settings: {},
        defaultValue: {},
      });
  },
};
