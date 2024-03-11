import { css } from '@emotion/css';
import React, { PureComponent } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from 'app/core/config';
import { DimensionContext } from 'app/features/dimensions/context';
import { ColorDimensionEditor } from 'app/features/dimensions/editors/ColorDimensionEditor';
import { TextDimensionEditor } from 'app/features/dimensions/editors/TextDimensionEditor';
import { getDataLinks } from 'app/plugins/panel/canvas/utils';

import { CanvasElementItem, CanvasElementProps, defaultBgColor, defaultTextColor } from '../element';
import { Align, VAlign, EllipseConfig, EllipseData } from '../types';

class EllipseDisplay extends PureComponent<CanvasElementProps<EllipseConfig, EllipseData>> {
  render() {
    const { data } = this.props;
    const styles = getStyles(config.theme2, data);
    return (
      <div className={styles.container}>
        <span className={styles.span}>{data?.text}</span>
      </div>
    );
  }
}

const getStyles = (theme: GrafanaTheme2, data: any) => ({
  container: css({
    display: 'table',
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    width: '100%',
    height: '100%',
    backgroundColor: data?.backgroundColor,
    border: `${data?.width}px solid ${data?.borderColor}`,
    // eslint-disable-next-line @grafana/no-border-radius-literal
    borderRadius: '50%',
  }),
  span: css({
    display: 'table-cell',
    verticalAlign: data?.valign,
    textAlign: data?.align,
    fontSize: `${data?.size}px`,
    color: data?.color,
  }),
});

export const ellipseItem: CanvasElementItem<EllipseConfig, EllipseData> = {
  id: 'ellipse',
  name: 'Ellipse',
  description: 'Ellipse',

  display: EllipseDisplay,

  defaultSize: {
    width: 160,
    height: 160,
  },

  getNewOptions: (options) => ({
    ...options,
    config: {
      backgroundColor: {
        fixed: defaultBgColor,
      },
      borderColor: {
        fixed: 'transparent',
      },
      width: 1,
      align: Align.Center,
      valign: VAlign.Middle,
      color: {
        fixed: defaultTextColor,
      },
    },
    background: {
      color: {
        fixed: 'transparent',
      },
    },
  }),

  prepareData: (ctx: DimensionContext, cfg: EllipseConfig) => {
    const data: EllipseData = {
      width: cfg.width,
      text: cfg.text ? ctx.getText(cfg.text).value() : '',
      align: cfg.align ?? Align.Center,
      valign: cfg.valign ?? VAlign.Middle,
      size: cfg.size,
    };

    if (cfg.backgroundColor) {
      data.backgroundColor = ctx.getColor(cfg.backgroundColor).value();
    }
    if (cfg.borderColor) {
      data.borderColor = ctx.getColor(cfg.borderColor).value();
    }
    if (cfg.color) {
      data.color = ctx.getColor(cfg.color).value();
    }

    data.links = getDataLinks(ctx, cfg, data.text);

    return data;
  },

  // Heatmap overlay options
  registerOptionsUI: (builder) => {
    const category = ['Ellipse'];
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
      })
      .addRadio({
        category,
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
        category,
        path: 'config.size',
        name: 'Text size',
        settings: {
          placeholder: 'Auto',
        },
      });
  },
};
