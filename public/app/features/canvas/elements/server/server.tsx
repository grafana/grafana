import { css } from '@emotion/css';

import { GrafanaTheme2, LinkModel, OneClickMode } from '@grafana/data';
import { ColorDimensionConfig, ScalarDimensionConfig } from '@grafana/schema';
import config from 'app/core/config';
import { DimensionContext } from 'app/features/dimensions';
import { ColorDimensionEditor, ScalarDimensionEditor } from 'app/features/dimensions/editors';

import { CanvasElementItem, CanvasElementOptions, CanvasElementProps } from '../../element';

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
  links?: LinkModel[];
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
      rotation: options?.placement?.rotation ?? 0,
    },
    config: {
      type: ServerType.Single,
    },
    oneClickMode: options?.oneClickMode ?? OneClickMode.Off,
    links: options?.links ?? [],
  }),

  // Called when data changes
  prepareData: (dimensionContext: DimensionContext, elementOptions: CanvasElementOptions<ServerConfig>) => {
    const serverConfig = elementOptions.config;

    const data: ServerData = {
      blinkRate: serverConfig?.blinkRate ? dimensionContext.getScalar(serverConfig.blinkRate).value() : 0,
      statusColor: serverConfig?.statusColor
        ? dimensionContext.getColor(serverConfig.statusColor).value()
        : 'transparent',
      bulbColor: serverConfig?.bulbColor ? dimensionContext.getColor(serverConfig.bulbColor).value() : 'green',
      type: serverConfig?.type ?? ServerType.Single,
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
  bulb: css({
    '@keyframes blink': {
      '0%': {
        fillOpacity: 0,
      },
      '50%': {
        fillOpacity: 1,
      },
      '100%': {
        fillOpacity: 0,
      },
    },
  }),
  server: css({
    fill: data?.statusColor ?? 'transparent',
  }),
  circle: css({
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      animation: `blink ${data?.blinkRate ? 1 / data.blinkRate : 0}s infinite step-end`,
    },
    fill: data?.bulbColor,
    stroke: 'none',
  }),
  circleBack: css({
    fill: outlineColor,
    stroke: 'none',
    opacity: 1,
  }),
  outline: css({
    stroke: outlineColor,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: '4px',
  }),
});
