import { faro, LogLevel } from '@grafana/faro-web-sdk';

import { config } from '../config';

export { LogLevel };

type Contexts = Record<string, Record<string, number | string | Record<string, string | number>>>;

/**
 * Log a message at INFO level
 * @public
 */
export function logInfo(message: string, contexts?: Contexts) {
  if (config.grafanaJavascriptAgent.enabled) {
    faro.api.pushLog([message], {
      level: LogLevel.INFO,
      context: contexts,
    });
  }
}

/**
 * Log a message at WARNING level
 *
 * @public
 */
export function logWarning(message: string, contexts?: Contexts) {
  if (config.grafanaJavascriptAgent.enabled) {
    faro.api.pushLog([message], {
      level: LogLevel.WARN,
      context: contexts,
    });
  }
}

/**
 * Log a message at DEBUG level
 *
 * @public
 */
export function logDebug(message: string, contexts?: Contexts) {
  if (config.grafanaJavascriptAgent.enabled) {
    faro.api.pushLog([message], {
      level: LogLevel.DEBUG,
      context: contexts,
    });
  }
}

/**
 * Log an error
 *
 * @public
 */
export function logError(err: Error, contexts?: Contexts) {
  if (config.grafanaJavascriptAgent.enabled) {
    faro.api.pushError(err);
  }
}
