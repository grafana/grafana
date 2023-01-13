import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { ColorDimensionConfig, DimensionContext, ScalarDimensionConfig } from 'app/features/dimensions';
import { ColorDimensionEditor, ScalarDimensionEditor } from 'app/features/dimensions/editors';

import { CanvasElementItem, CanvasElementProps } from '../../element';

import { ServerDatabase } from './types/database';
import { ServerSingle } from './types/single';
import { ServerStack } from './types/stack';
import { ServerTerminal } from './types/terminal';

interface ServerConfig {
  blinkRate?: ScalarDimensionConfig;
  statusColor?: ColorDimensionConfig;
  bulbColor?: ColorDimensionConfig;
  type: ServerType;
}

export interface ServerData {
  blinkRate?: number;
  statusColor?: string;
  bulbColor?: string;
  type: ServerType;
}

enum ServerType {
  Single = 'Single',
  Stack = 'Stack',
  Database = 'Database',
  Terminal = 'Terminal',
}

type Props = CanvasElementProps<ServerConfig, ServerData>;

const ServerDisplay = ({ data }: Props) => {
  return data ? (
    <svg viewBox="0 0 207.95 197.78">
      {data.type === ServerType.Single ? (
        <ServerSingle {...data} />
      ) : data.type === ServerType.Stack ? (
        <ServerStack {...data} />
      ) : data.type === ServerType.Database ? (
        <ServerDatabase {...data} />
      ) : data.type === ServerType.Terminal ? (
        <ServerTerminal {...data} />
      ) : null}
    </svg>
  ) : null;
};

export const serverItem: CanvasElementItem<ServerConfig, ServerData> = {
  id: 'server',
  name: 'Server',
  description: 'Basic server with status',

  display: ServerDisplay,

  defaultSize: {
    width: 100,
    height: 100,
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
      height: options?.placement?.height ?? 100,
      top: options?.placement?.top,
      left: options?.placement?.left,
    },
    config: {
      type: ServerType.Single,
    },
  }),

  // Called when data changes
  prepareData: (ctx: DimensionContext, cfg: ServerConfig) => {
    const data: ServerData = {
      blinkRate: cfg?.blinkRate ? ctx.getScalar(cfg.blinkRate).value() : 0,
      statusColor: cfg?.statusColor ? ctx.getColor(cfg.statusColor).value() : '#8a8a8a',
      bulbColor: cfg?.bulbColor ? ctx.getColor(cfg.bulbColor).value() : 'green',
      type: cfg.type,
    };

    return data;
  },

  registerOptionsUI: (builder) => {
    const category = ['Server'];
    builder
      .addSelect({
        category,
        path: 'config.type',
        name: 'Type',
        settings: {
          options: [
            { value: ServerType.Single, label: ServerType.Single },
            { value: ServerType.Stack, label: ServerType.Stack },
            { value: ServerType.Database, label: ServerType.Database },
            { value: ServerType.Terminal, label: ServerType.Terminal },
          ],
        },
        defaultValue: ServerType.Single,
      })
      .addCustomEditor({
        category,
        id: 'statusColor',
        path: 'config.statusColor',
        name: 'Status color',
        editor: ColorDimensionEditor,
        settings: {},
        defaultValue: {
          fixed: '#8a8a8a',
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
        name: 'Blink rate [hz] (0 = off)',
        editor: ScalarDimensionEditor,
        settings: { min: 0, max: 100 },
      });
  },
};

export const getServerStyles = (data: ServerData | undefined) => (theme: GrafanaTheme2) => ({
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
    stroke: ${data?.statusColor ?? '#8a8a8a'};
  `,
  circle: css`
    animation: blink ${data?.blinkRate ? 1 / data.blinkRate : 0}s infinite step-end;
    fill: ${data?.bulbColor};
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
    stroke: ${data?.statusColor ?? '#8a8a8a'};
    fill: #fff;
    stroke-linecap: square;
    stroke-miterlimit: 0;
    stroke-width: 14;
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
    stroke: ${data?.statusColor ?? '#8a8a8a'};
  `,
});
