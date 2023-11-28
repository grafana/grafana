/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions, no-console */
import { truncate } from '../utils/truncate';
import { LOG_LEVELS } from './config';
let CONFIG_LOG_LEVEL = LOG_LEVELS.DEBUG;
/**
 * Setting log level to >= 5 will completely silence the logger,
 * i.e. run `setLogLevel(5);`
 */
export const setLogLevel = (level) => {
    CONFIG_LOG_LEVEL = level;
};
const LOG_LEVEL_KEYS = Object.keys(LOG_LEVELS).slice(5);
const createLogMethod = (loggerFunc, level) => (first, ...rest) => {
    if (level >= CONFIG_LOG_LEVEL) {
        const key = LOG_LEVEL_KEYS[level];
        console.group(`[${key}]`, truncate(50)(first));
        loggerFunc(first);
        rest.forEach((paragraph) => {
            loggerFunc(paragraph);
        });
        console.groupEnd();
    }
};
export const debug = createLogMethod(console.debug, LOG_LEVELS.DEBUG);
export const log = createLogMethod(console.log, LOG_LEVELS.LOG);
export const info = createLogMethod(console.info, LOG_LEVELS.INFO);
export const warn = createLogMethod(console.warn, LOG_LEVELS.WARN);
export const error = createLogMethod(console.error, LOG_LEVELS.ERROR);
/* eslint-enable no-console */
//# sourceMappingURL=logger.js.map