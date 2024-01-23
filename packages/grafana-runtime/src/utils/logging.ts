import { faro, LogContext, LogLevel } from '@grafana/faro-web-sdk';

import { config } from '../config';

export { LogLevel };

/**
 * Log a message at INFO level
 * @public
 */
export function logInfo(message: string, contexts?: LogContext) {
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
export function logWarning(message: string, contexts?: LogContext) {
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
export function logDebug(message: string, contexts?: LogContext) {
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
export function logError(err: Error, contexts?: LogContext) {
  if (config.grafanaJavascriptAgent.enabled) {
    faro.api.pushError(err, {
      context: contexts,
    });
  }
}

/**
 * Wrapper for logX functions.
 * Creates a logger for frontend monitoring which contains provided "source" and context as defaults when calling logX()
 */
export function createMonitoringLogger(source: string, defaultContext?: LogContext) {
  const createFullContext = (contexts?: LogContext) => ({
    source: source,
    ...defaultContext,
    ...contexts,
  });

  return {
    logDebug: (message: string, contexts?: LogContext) => logDebug(message, createFullContext(contexts)),
    logInfo: (message: string, contexts?: LogContext) => logInfo(message, createFullContext(contexts)),
    logWarning: (message: string, contexts?: LogContext) => logWarning(message, createFullContext(contexts)),
    logError: (error: Error, contexts?: LogContext) => logError(error, createFullContext(contexts)),
  };
}
