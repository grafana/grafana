import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { ColorDimensionConfig, DimensionContext, ScalarDimensionConfig } from 'app/features/dimensions';
import { ColorDimensionEditor, ScalarDimensionEditor } from 'app/features/dimensions/editors';

import { CanvasElementItem, CanvasElementProps } from '../element';

interface ServerConfig {
  blinkRate?: ScalarDimensionConfig;
  statusColor?: ColorDimensionConfig;
  bulbColor?: ColorDimensionConfig;
  type: ServerTypes;
}

interface ServerData {
  blinkRate?: number;
  statusColor?: string;
  bulbColor?: string;
  type: ServerTypes;
}

enum ServerTypes {
  Single = 'Single',
  Stack = 'Stack',
  Database = 'Database',
  Terminal = 'Terminal',
}

type Props = CanvasElementProps<ServerConfig, ServerData>;

const ServerDisplay = ({ data }: Props) => {
  const styles = useStyles2(getStyles);

  const bulbColor = data?.bulbColor;
  const bulbAnimation = `blink ${data?.blinkRate ? 1 / data.blinkRate : 0}s infinite step-end`;

  return (
    <svg viewBox="0 0 207.95 197.78">
      {data?.type === ServerTypes.Stack ? (
        <>
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
        </>
      ) : data?.type === ServerTypes.Single ? (
        <>
          <defs>
            <clipPath id="serverb">
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
              clipPath="url(#serverb)"
            />
            <rect x="41.836" y="34.652" width="187.91" height="176.89" style={{ fill: data?.statusColor }} />
            <g>
              <path
                className={styles.server}
                x="54.86203"
                y="48.088943"
                width="159.1676"
                height="39.961231"
                d="m56.979 48.089h154.93c1.169 0 2.1167.94768 2.1167 2.1167v145.73c0 1.169-.94768 2.1167-2.1167 2.1167h-154.93c-1.169 0-2.1167-.94768-2.1167-2.1167v-145.73c0-1.169.94768-2.1167 2.1167-2.1167z"
              />
              <circle
                className={styles.circle}
                cx="189.99"
                cy="68.07"
                r="9.0052"
                style={{ animation: bulbAnimation, fill: bulbColor }}
              />
              <rect x="55.556" y="57.472" width="107.76" height="5.7472" />
              <rect x="55.558" y="86.141" width="107.76" height="5.7472" />
              <rect transform="translate(31.804,24.362)" x="23.779" y="90.421" width="107.76" height="5.7472" />
              <g className={styles.thinLine}>
                <rect x="63.549" y="73.261" width="107.76" height="2.8736" />
                <rect x="63.574" y="101.9" width="107.76" height="2.8736" />
                <rect x="63.598" y="130.54" width="107.76" height="2.8736" />
              </g>
            </g>
          </g>
        </>
      ) : data?.type === ServerTypes.Database ? (
        <>
          {' '}
          <defs>
            <clipPath id="serverb">
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
          <g transform="translate(-31.804 -24.62)">
            <path
              className={styles.outline}
              x="36.804028"
              y="29.620079"
              width="197.94514"
              height="186.92975"
              d="m38.921 29.62h193.71a2.1167 2.1167 45 012.1167 2.1167v182.7a2.1167 2.1167 135 01-2.1167 2.1167h-193.71a2.1167 2.1167 45 01-2.1167-2.1167v-182.7a2.1167 2.1167 135 012.1167-2.1167z"
              clipPath="url(#serverb)"
            />
            <rect x="41.836" y="34.652" width="187.91" height="176.89" style={{ fill: data?.statusColor }} />
            <g className={styles.server} transform="translate(0 -3.0868)">
              <ellipse cx="134.44" cy="68.233" rx="78.553" ry="22.49" />
              <path
                x="54.86203"
                y="48.088943"
                width="159.1676"
                height="39.961231"
                d="m56.97 90.429c52.35 16.952 102.23 16.952 154.93 0 1.1129-.35795 2.1167.94768 2.1167 2.1167v22.23c0 1.169-1.0017 1.7655-2.1167 2.1167-52.703 16.599-102.58 16.952-154.93 0-1.1122-.36014-2.1167-.94768-2.1167-2.1167v-22.23c0-1.169 1.0045-2.4768 2.1167-2.1167z"
              />
              <path
                x="54.86203"
                y="48.088943"
                width="159.1676"
                height="39.961231"
                d="m56.983 128.77c52.35 16.952 102.23 16.952 154.93 0 1.1129-.35795 2.1167.94768 2.1167 2.1167v22.23c0 1.169-1.0017 1.7655-2.1167 2.1167-52.703 16.599-102.58 16.952-154.93 0-1.1122-.36014-2.1167-.94768-2.1167-2.1167v-22.23c0-1.169 1.0045-2.4768 2.1167-2.1167z"
              />
              <path
                x="54.86203"
                y="48.088943"
                width="159.1676"
                height="39.961231"
                d="m57.004 167.17c52.35 16.952 102.23 16.952 154.93 0 1.1129-.35795 2.1167.94768 2.1167 2.1167v22.23c0 1.169-1.0017 1.7655-2.1167 2.1167-52.703 16.599-102.58 16.952-154.93 0-1.1122-.36014-2.1167-.94768-2.1167-2.1167v-22.23c0-1.169 1.0045-2.4768 2.1167-2.1167z"
              />
            </g>
            <g
              className={styles.circle}
              transform="translate(-4.9944 -3.9978)"
              style={{ animation: bulbAnimation, fill: bulbColor }}
            >
              <circle cx="161.69" cy="193.26" r="5.0317" />
              <circle cx="180.31" cy="190.08" r="5.0317" />
              <circle cx="198.14" cy="185.84" r="5.0317" />
            </g>
          </g>
        </>
      ) : data?.type === ServerTypes.Terminal ? (
        <>
          <defs>
            <clipPath id="serverb">
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
              clipPath="url(#serverb)"
            />
            <rect x="41.836" y="34.652" width="187.91" height="176.89" style={{ fill: data?.statusColor }} />
            <g>
              <path
                className={styles.server}
                x="54.86203"
                y="48.088943"
                width="159.1676"
                height="39.961231"
                d="m56.979 48.089h54.93c1.169 0 2.1167.94768 2.1167 2.1167v145.73c0 1.169-.94768 2.1167-2.1167 2.1167h-54.93c-1.169 0-2.1167-.94768-2.1167-2.1167v-145.73c0-1.169.94768-2.1167 2.1167-2.1167z"
              />
              <g transform="matrix(.50833 0 0 1 27.315 0)">
                <rect x="55.556" y="57.472" width="107.76" height="5.7472" />
                <rect x="55.558" y="86.141" width="107.76" height="5.7472" />
                <g className={styles.thinLine}>
                  <rect x="74.357" y="73.261" width="96.957" height="2.8736" />
                  <rect x="74.379" y="101.9" width="96.957" height="2.8736" />
                </g>
              </g>
              <circle
                className={styles.circle}
                cx="83.858"
                cy="178.2"
                r="5.9401"
                style={{ animation: bulbAnimation, fill: bulbColor }}
              />
            </g>
            <g transform="translate(-1.9978 -7.5028)">
              <path className={styles.monitor} d="m103.22 75.305h118.87v76.914h-118.87z" />
              <path
                className={styles.monitorOutline}
                d="m103.22 70.305-5 5v76.916l5 5h118.87l5-5v-76.916l-5-5zm5 10h108.87v58.916h-108.87z"
              />
            </g>
            <path d="m135.6 148.14h50.113l4 15.156h-58.113z" />
            <path className={styles.keyboard} d="m118.23 183.19h88.848l24 19.476h-136.85z" />
          </g>
        </>
      ) : null}
    </svg>
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
      type: cfg?.type ?? ServerTypes.Single,
    };

    return data;
  },

  registerOptionsUI: (builder) => {
    const category = ['Server'];
    builder
      .addRadio({
        category,
        path: 'config.type',
        name: 'Type',
        settings: {
          options: [
            { value: ServerTypes.Single, label: 'Single' },
            { value: ServerTypes.Stack, label: 'Stack' },
            { value: ServerTypes.Database, label: 'Database' },
            { value: ServerTypes.Terminal, label: 'Terminal' },
          ],
        },
        defaultValue: ServerTypes.Single,
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
        id: 'blinkRate',
        path: 'config.blinkRate',
        name: 'Blink Rate [hz] (0 = off)',
        editor: ScalarDimensionEditor,
        settings: { min: 0, max: 100 },
      });
  },
};

const getStyles = (theme: GrafanaTheme2) => ({
  bulb: css`
    @keyframes blink {
      0% {
        fill-opacity: 0;
      }
      50% {
        fill-opacity: 1;
      }
      100% {
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
    stroke-width: 3;
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
  thinLine: css`
    stroke-width: 0.7;
  `,
  monitor: css`
    stroke: #8a8a8a;
    fill: #fff;
    stroke-linecap: square;
    stroke-miterlimit: 0;
    stroke-width: 12;
  `,
  monitorOutline: css`
    stroke: #8a8a8a;
    stroke-linecap: square;
    stroke-miterlimit: 0;
  `,
  keyboard: css`
    fill: #dadada;
    stroke-linecap: round;
    stroke-miterlimit: 10;
    stroke-width: 10;
    stroke: #303030;
  `,
});
