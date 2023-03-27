import { captureMessage, captureException, Severity as LogLevel } from '@sentry/browser';

import { faro, LogLevel as GrafanaLogLevel } from '@grafana/faro-web-sdk';

import { config } from '../config';

export { LogLevel };

// a bit stricter than what Sentry allows
type Contexts = Record<string, Record<string, number | string | Record<string, string | number>>>;

/**
 * Log a message at INFO level. Depending on configuration might be forwarded to backend and logged to stdout or sent to Sentry
 *
 * @public
 */
export function logInfo(message: string, contexts?: Contexts) {
  if (config.grafanaJavascriptAgent.enabled) {
    faro.api.pushLog([message], {
      level: GrafanaLogLevel.INFO,
      context: contexts,
    });
  }
  if (config.sentry.enabled) {
    captureMessage(message, {
      level: LogLevel.Info,
      contexts,
    });
  }
}

/**
 * Log a message at WARNING level. Depending on configuration might be forwarded to backend and logged to stdout or sent to Sentry
 *
 * @public
 */
export function logWarning(message: string, contexts?: Contexts) {
  if (config.grafanaJavascriptAgent.enabled) {
    faro.api.pushLog([message], {
      level: GrafanaLogLevel.WARN,
      context: contexts,
    });
  }
  if (config.sentry.enabled) {
    captureMessage(message, {
      level: LogLevel.Warning,
      contexts,
    });
  }
}

/**
 * Log a message at DEBUG level. Depending on configuration might be forwarded to backend and logged to stdout or sent to Sentry
 *
 * @public
 */
export function logDebug(message: string, contexts?: Contexts) {
  if (config.grafanaJavascriptAgent.enabled) {
    faro.api.pushLog([message], {
      level: GrafanaLogLevel.DEBUG,
      context: contexts,
    });
  }
  if (config.sentry.enabled) {
    captureMessage(message, {
      level: LogLevel.Debug,
      contexts,
    });
  }
}

/**
 * Log an error. Depending on configuration might be forwarded to backend and logged to stdout or sent to Sentry
 *
 * @public
 */
export function logError(err: Error, contexts?: Contexts) {
  if (config.grafanaJavascriptAgent.enabled) {
    faro.api.pushError(err);
  }
  if (config.sentry.enabled) {
    captureException(err, { contexts });
  }
}
