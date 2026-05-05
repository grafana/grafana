import { type LogContext } from '@grafana/faro-web-sdk';

export type LoggerDefaults = { context?: Omit<LogContext, 'source'>; logToConsole?: boolean };

export const Loggers = {
  'grafana/runtime.plugins.meta': { logToConsole: true },
  'grafana/runtime.plugins.settings': { logToConsole: true },
  'grafana/runtime.utils.getCachedPromise': {},
} satisfies Record<string, LoggerDefaults>;

export type LoggerSource = keyof typeof Loggers;
