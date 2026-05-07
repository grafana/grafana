import { type LogContext } from '@grafana/faro-web-sdk';

export type LoggerDefaults = { context?: Omit<LogContext, 'source'>; logToConsole?: boolean };

export const Loggers = {
  /* new loggers should follow package/area.feature naming convention */
  'grafana/runtime.plugins.meta': { logToConsole: true },
  'grafana/runtime.plugins.settings': { logToConsole: true },
  'grafana/runtime.utils.getCachedPromise': {},

  /* existing loggers that keep their existing source name */
  sandbox: {},
  'ui-extension-logs': {},
  'features.plugins': {},
  'features.alerting': { context: { module: 'Alerting' } },
  'features.correlations': {},
} satisfies Record<string, LoggerDefaults>;

export type LoggerSource = keyof typeof Loggers;
