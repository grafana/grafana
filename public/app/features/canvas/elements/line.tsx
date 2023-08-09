import { css } from '@emotion/css';
import React, { PureComponent } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { stylesFactory } from '@grafana/ui';
import { config } from 'app/core/config';
import { DimensionContext } from 'app/features/dimensions/context';

import { CanvasElementItem, CanvasElementProps } from '../element';

interface LineData {
  color?: string;
  size?: number;
}

interface LineConfig {
  color?: string;
  size?: number;
}

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
    height: ${data?.size}px;
    background-color: ${data?.backgroundColor};
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
      color: 'red',
      size: 3,
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
      color: cfg.color,
      size: cfg.size,
    };

    return data;
  },
};
