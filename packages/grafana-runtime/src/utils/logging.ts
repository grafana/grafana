import { captureMessage, captureException, Severity as LogLevel } from '@sentry/browser';
export { LogLevel };

// a bit stricter than what Sentry allows
type Contexts = Record<string, Record<string, number | string | Record<string, string | number>>>;

/**
 * Log a message. Depending on configuration might be forwarded to backend and logged to stdout or sent to Sentry
 *
 * @public
 */
export function logMessage(message: string, contexts?: Contexts, level = LogLevel.Info) {
  captureMessage(message, {
    level,
    contexts,
  });
}

/**
 * Log an error. Depending on configuration might be forwarded to backend and logged to stdout or sent to Sentry
 *
 * @public
 */
export function logError(err: Error, contexts?: Contexts) {
  captureException(err, { contexts });
}
