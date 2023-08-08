// import { css } from '@emotion/css';
import React, { PureComponent } from 'react';

// import { GrafanaTheme2 } from '@grafana/data';
// import { stylesFactory } from '@grafana/ui';
// import { config } from 'app/core/config';
import { DimensionContext } from 'app/features/dimensions/context';
// import { ColorDimensionEditor } from 'app/features/dimensions/editors/ColorDimensionEditor';
// import { TextDimensionEditor } from 'app/features/dimensions/editors/TextDimensionEditor';

import { CanvasElementItem, CanvasElementProps, defaultBgColor, defaultTextColor } from '../element';
import { Align, TextConfig, TextData, VAlign } from '../types';

interface LineData {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: string;
  strokeWidth: number;
}

interface LineElementProps<LineData> extends CanvasElementProps<TextConfig, TextData> {
  lineData: LineData;
}

// interface LineElementItem<> {}

// class LineDisplay extends PureComponent<CanvasElementProps<TextConfig, TextData>> {
class LineDisplay extends PureComponent<LineElementProps<LineData>> {
  render() {
    const { data } = this.props;
    console.log({ data });
    // const styles = getStyles(config.theme2, data);
    return (
      <svg>
        <g>
          <defs></defs>
          <line x1={100} y1={100} x2={200} y2={100} stroke={'green'} strokeWidth={3} />
        </g>
      </svg>
    );
  }
}
// const getStyles = stylesFactory((theme: GrafanaTheme2, data) => ({
//   container: css`
//     position: absolute;
//     height: 100%;
//     width: 100%;
//     display: table;
//   `,
//   span: css`
//     display: table-cell;
//     vertical-align: ${data?.valign};
//     text-align: ${data?.align};
//     font-size: ${data?.size}px;
//     color: ${data?.color};
//   `,
// }));
export const lineItem: CanvasElementItem<TextConfig, LineData> = {
  id: 'line',
  name: 'Line',
  description: 'Line',

  display: LineDisplay,

  // defaultSize: {
  //   width: 100,
  //   height: 3,
  // },

  getNewOptions: (options) => ({
    ...options,
    config: {
      align: Align.Center,
      valign: VAlign.Middle,
      color: {
        fixed: defaultTextColor,
      },
    },
    background: {
      color: {
        fixed: defaultBgColor,
      },
    },
  }),

  // Called when data changes
  prepareData: (ctx: DimensionContext, cfg: TextConfig) => {
    // const data: TextData = {
    //   text: cfg.text ? ctx.getText(cfg.text).value() : '',
    //   align: cfg.align ?? Align.Center,
    //   valign: cfg.valign ?? VAlign.Middle,
    //   size: cfg.size,
    // };

    // if (cfg.color) {
    //   data.color = ctx.getColor(cfg.color).value();
    // }

    const data: LineData = {
      x1: 100,
      y1: 100,
      x2: 300,
      y2: 100,
      stroke: 'green',
      strokeWidth: 3,
    };

    return data;
  },
};
