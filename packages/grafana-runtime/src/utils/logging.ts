import { faro, LogContext, LogLevel } from '@grafana/faro-web-sdk';
import { attachDebugger, createLogger } from '@grafana/ui';

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

const debuggingLogger = createLogger('monitoring');

/**
 * Creates a scoped logger for frontend monitoring. Provided source is included in the config.
 */
export function createMonitoringLogger(source: string, defaultContext?: LogContext) {
  attachDebugger(`monitoring.${source}`, undefined, debuggingLogger);
  const createFullContext = (contexts?: LogContext) => ({
    source: source,
    ...defaultContext,
    ...contexts,
  });

  const forwardMessage = (fn: typeof logInfo, level: LogLevel, message: string, contexts?: LogContext) => {
    const ctx = createFullContext(contexts);
    fn(message, ctx);
    debuggingLogger.logger(source, false, level, message, ctx);
  };

  return {
    logDebug: (message: string, contexts?: LogContext) => forwardMessage(logDebug, LogLevel.DEBUG, message, contexts),
    logInfo: (message: string, contexts?: LogContext) => forwardMessage(logDebug, LogLevel.INFO, message, contexts),
    logWarning: (message: string, contexts?: LogContext) => forwardMessage(logDebug, LogLevel.WARN, message, contexts),
    logError: (error: Error, contexts?: LogContext) => {
      const ctx = createFullContext(contexts);
      logError(error, ctx);
      debuggingLogger.logger(source, false, LogLevel.ERROR, error, ctx);
    },
  };
}
