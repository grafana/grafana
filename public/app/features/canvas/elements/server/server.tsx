import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { ColorDimensionConfig, ScalarDimensionConfig } from '@grafana/schema';
import config from 'app/core/config';
import { DimensionContext } from 'app/features/dimensions';
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
const outlineColor = config.theme2.colors.text.primary;

const ServerDisplay = ({ data }: Props) => {
  return data ? (
    <svg viewBox="0 0 75 75">
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
      statusColor: cfg?.statusColor ? ctx.getColor(cfg.statusColor).value() : 'transparent',
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
    fill: ${data?.statusColor ?? 'transparent'};
  `,
  circle: css`
    animation: blink ${data?.blinkRate ? 1 / data.blinkRate : 0}s infinite step-end;
    fill: ${data?.bulbColor};
    stroke: none;
  `,
  circleBack: css`
    fill: ${outlineColor};
    stroke: none;
    opacity: 1;
  `,
  outline: css`
    stroke: ${outlineColor};
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 4px;
  `,
});
