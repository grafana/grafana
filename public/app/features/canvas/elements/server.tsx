import { css } from '@emotion/css';
import React, { FC } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { ColorDimensionConfig, DimensionContext, ScalarDimensionConfig } from 'app/features/dimensions';
import { ColorDimensionEditor, ScalarDimensionEditor } from 'app/features/dimensions/editors';

import { CanvasElementItem, CanvasElementProps } from '../element';

interface ServerConfig {
  blinkRate?: ScalarDimensionConfig;
  statusColor?: ColorDimensionConfig;
  bulbColor?: ColorDimensionConfig;
}

interface ServerData {
  blinkRate?: number;
  statusColor?: string;
  bulbColor?: string;
}

const ServerDisplay: FC<CanvasElementProps<ServerConfig, ServerData>> = (props) => {
  const styles = useStyles2(getStyles);

  const { data } = props;

  const bulbColor = data?.bulbColor;
  const bulbAnimation = `blink ${data?.blinkRate ? data.blinkRate : 0}s infinite`;

  return (
    <>
      <svg viewBox="0 0 207.95 197.78">
        <defs>
          <clipPath id="servera">
            <rect
              className={styles.pathA}
              x="77.108"
              y="24.362"
              width="115.9"
              height="197.78"
              d="M 77.107697,24.361513 H 193.00871 V 222.14392 H 77.107697 Z"
            />
            <path
              className={styles.pathB}
              d="m26.804 19.62h217.95v206.93h-217.95zm50.304 4.7414v197.78h115.9v-197.78z"
            />
          </clipPath>
        </defs>
        <g transform="translate(-31.804 -24.362)">
          <path
            className={styles.outline}
            x="36.804028"
            y="29.620079"
            width="197.94514"
            height="186.92975"
            d="m38.921 29.62h193.71a2.1167 2.1167 45 012.1167 2.1167v182.7a2.1167 2.1167 135 01-2.1167 2.1167h-193.71a2.1167 2.1167 45 01-2.1167-2.1167v-182.7a2.1167 2.1167 135 012.1167-2.1167z"
            clipPath="url(#servera)"
          />
          <rect x="41.836" y="34.652" width="187.91" height="176.89" style={{ fill: data?.statusColor }} />
          <g>
            <path
              className={styles.server}
              x="54.86203"
              y="48.088943"
              width="159.1676"
              height="39.961231"
              d="m56.979 48.089h154.93a2.1167 2.1167 45 012.1167 2.1167v35.728a2.1167 2.1167 135 01-2.1167 2.1167h-154.93a2.1167 2.1167 45 01-2.1167-2.1167v-35.728a2.1167 2.1167 135 012.1167-2.1167z"
            />
            <rect x="55.556" y="57.472" width="107.76" height="5.7472" />
            <rect x="55.549" y="71.824" width="107.76" height="5.7472" />
            <circle
              className={styles.circle}
              cx="189.99"
              cy="68.07"
              r="9.0052"
              style={{ animation: bulbAnimation, fill: bulbColor }}
            />
          </g>
          <g transform="translate(0 55.18)">
            <path
              className={styles.server}
              x="54.86203"
              y="48.088943"
              width="159.1676"
              height="39.961231"
              d="m56.979 48.089h154.93a2.1167 2.1167 45 012.1167 2.1167v35.728a2.1167 2.1167 135 01-2.1167 2.1167h-154.93a2.1167 2.1167 45 01-2.1167-2.1167v-35.728a2.1167 2.1167 135 012.1167-2.1167z"
            />
            <rect x="55.556" y="57.472" width="107.76" height="5.7472" />
            <rect x="55.549" y="71.824" width="107.76" height="5.7472" />
            <circle
              className={styles.circle}
              cx="189.99"
              cy="68.07"
              r="9.0052"
              style={{ animation: bulbAnimation, fill: bulbColor }}
            />
          </g>
          <g transform="translate(0 110)">
            <path
              className={styles.server}
              x="54.86203"
              y="48.088943"
              width="159.1676"
              height="39.961231"
              d="m56.979 48.089h154.93a2.1167 2.1167 45 012.1167 2.1167v35.728a2.1167 2.1167 135 01-2.1167 2.1167h-154.93a2.1167 2.1167 45 01-2.1167-2.1167v-35.728a2.1167 2.1167 135 012.1167-2.1167z"
            />
            <rect x="55.556" y="57.472" width="107.76" height="5.7472" />
            <rect x="55.549" y="71.824" width="107.76" height="5.7472" />
            <circle
              className={styles.circle}
              cx="189.99"
              cy="68.07"
              r="9.0052"
              style={{ animation: bulbAnimation, fill: bulbColor }}
            />
          </g>
        </g>
      </svg>
    </>
  );
};

export const serverItem: CanvasElementItem<ServerConfig, ServerData> = {
  id: 'server',
  name: 'Server',
  description: 'Basic server with status',

  display: ServerDisplay,

  defaultSize: {
    width: 100,
    height: 155,
  },

  getNewOptions: (options) => ({
    ...options,
    background: {
      color: {
        fixed: 'transparent',
      },
    },
    placement: {
      width: options?.placement?.width ?? 100,
      height: options?.placement?.height ?? 155,
      top: options?.placement?.top,
      left: options?.placement?.left,
    },
  }),

  // Called when data changes
  prepareData: (ctx: DimensionContext, cfg: ServerConfig) => {
    const data: ServerData = {
      blinkRate: cfg?.blinkRate ? ctx.getScalar(cfg.blinkRate).value() : 0,
      statusColor: cfg?.statusColor ? ctx.getColor(cfg.statusColor).value() : 'transparent',
      bulbColor: cfg?.bulbColor ? ctx.getColor(cfg.bulbColor).value() : 'green',
    };

    return data;
  },

  registerOptionsUI: (builder) => {
    const category = ['Server'];
    builder
      .addCustomEditor({
        category,
        id: 'blinkRate',
        path: 'config.blinkRate',
        name: 'Blink Duration (s)',
        editor: ScalarDimensionEditor,
      })
      .addCustomEditor({
        category,
        id: 'bulbColor',
        path: 'config.bulbColor',
        name: 'Bulb color',
        editor: ColorDimensionEditor,
        settings: {},
        defaultValue: {
          fixed: 'green',
        },
      })
      .addCustomEditor({
        category,
        id: 'statusColor',
        path: 'config.statusColor',
        name: 'Status color',
        editor: ColorDimensionEditor,
        settings: {},
        defaultValue: {
          fixed: 'transparent',
        },
      });
  },
};

const getStyles = (theme: GrafanaTheme2) => ({
  bulb: css`
    @keyframes blink {
      100%,
      0% {
        fill-opacity: 1;
      }
      60% {
        fill-opacity: 0;
      }
    }
  `,
  server: css`
    fill: #dadada;
    stroke-linecap: round;
    stroke-miterlimit: 10;
    stroke-width: 10;
    stroke: #8a8a8a;
  `,
  circle: css`
    fill: #00ff1b;
    stroke-linecap: round;
    stroke-miterlimit: 10;
    stroke-width: 4;
    stroke: #000;
  `,
  outline: css`
    fill: none;
    stroke-linecap: round;
    stroke-miterlimit: 10;
    stroke-width: 10;
    stroke: #303030;
  `,
  pathA: css`
    display: none;
    fill: #fff;
  `,
  pathB: css`
    fill: #fff;
  `,
});
