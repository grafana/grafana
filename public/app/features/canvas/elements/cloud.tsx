import { css } from '@emotion/css';
import React, { PureComponent } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from 'app/core/config';
import { DimensionContext } from 'app/features/dimensions';
import { ColorDimensionEditor } from 'app/features/dimensions/editors/ColorDimensionEditor';
import { TextDimensionEditor } from 'app/features/dimensions/editors/TextDimensionEditor';
import { getDataLinks } from 'app/plugins/panel/canvas/utils';

import { CanvasElementItem, CanvasElementProps, defaultBgColor, defaultTextColor } from '../element';
import { Align, TextConfig, TextData, VAlign } from '../types';

class Cloud extends PureComponent<CanvasElementProps<TextConfig, TextData>> {
  render() {
    const { data } = this.props;
    const styles = getStyles(config.theme2, data);

    return (
      <div className={styles.container}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          xmlnsXlink="http://www.w3.org/1999/xlink"
          viewBox="0 0 110 70"
          width="100%"
          height="100%"
          style={{
            stroke: defaultBgColor,
            fill: defaultBgColor,
            maxWidth: '100%',
            height: 'intrinsic',
          }}
          preserveAspectRatio="none"
        >
          <path
            d="M 23 13 C -1 13 -7 33 12.2 37 C -7 45.8 14.6 65 30.2 57 C 41 73 77 73 89 57 C 113 57 113 41 98 33 C 113 17 89 1 68 9 C 53 -3 29 -3 23 13 Z"
            fill={defaultBgColor}
            stroke="rgb(0, 0, 0)"
            strokeMiterlimit="10"
            pointerEvents="all"
          />
        </svg>
        <span className={styles.text}>{data?.text}</span>
      </div>
    );
  }
}

export const cloudItem: CanvasElementItem = {
  id: 'cloud',
  name: 'Cloud',
  description: 'Cloud',

  display: Cloud,

  defaultSize: {
    width: 110,
    height: 70,
  },

  getNewOptions: (options) => ({
    ...options,
    background: {
      color: {
        fixed: 'transparent',
      },
    },
    config: {
      align: Align.Center,
      valign: VAlign.Middle,
      color: {
        fixed: defaultTextColor,
      },
    },
    placement: {
      width: options?.placement?.width ?? 110,
      height: options?.placement?.height ?? 70,
      top: options?.placement?.top,
      left: options?.placement?.left,
    },
  }),

  // Called when data changes
  prepareData: (ctx: DimensionContext, cfg: TextConfig) => {
    const data: TextData = {
      text: cfg.text ? ctx.getText(cfg.text).value() : '',
      align: cfg.align ?? Align.Center,
      valign: cfg.valign ?? VAlign.Middle,
      size: cfg.size,
    };

    if (cfg.color) {
      data.color = ctx.getColor(cfg.color).value();
    }

    data.links = getDataLinks(ctx, cfg, data.text);

    return data;
  },

  registerOptionsUI: (builder) => {
    const category = ['Cloud'];
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

const getStyles = (theme: GrafanaTheme2, data: TextData | undefined) => ({
  container: css({
    height: '100%',
    width: '100%',
  }),
  text: css({
    position: 'absolute',
    top: data?.valign === VAlign.Middle ? '50%' : data?.valign === VAlign.Top ? '10%' : '90%',
    left: data?.align === Align.Center ? '50%' : data?.align === Align.Left ? '10%' : '90%',
    transform: `translate(${data?.align === Align.Center ? '-50%' : data?.align === Align.Left ? '10%' : '-90%'}, ${data?.valign === VAlign.Middle ? '-50%' : data?.valign === VAlign.Top ? '10%' : '-90%'})`,
    fontSize: `${data?.size}px`,
    color: data?.color,
  }),
});
