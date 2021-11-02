import { captureMessage, captureException, Severity as LogLevel } from '@sentry/browser';
export { LogLevel };
/**
 * Log a message at INFO level. Depending on configuration might be forwarded to backend and logged to stdout or sent to Sentry
 *
 * @public
 */
export function logInfo(message, contexts) {
    captureMessage(message, {
        level: LogLevel.Info,
        contexts: contexts,
    });
}
/**
 * Log a message at WARNING level. Depending on configuration might be forwarded to backend and logged to stdout or sent to Sentry
 *
 * @public
 */
export function logWarning(message, contexts) {
    captureMessage(message, {
        level: LogLevel.Warning,
        contexts: contexts,
    });
}
/**
 * Log a message at DEBUG level. Depending on configuration might be forwarded to backend and logged to stdout or sent to Sentry
 *
 * @public
 */
export function logDebug(message, contexts) {
    captureMessage(message, {
        level: LogLevel.Debug,
        contexts: contexts,
    });
}
/**
 * Log an error. Depending on configuration might be forwarded to backend and logged to stdout or sent to Sentry
 *
 * @public
 */
export function logError(err, contexts) {
    captureException(err, { contexts: contexts });
}
//# sourceMappingURL=logging.js.map