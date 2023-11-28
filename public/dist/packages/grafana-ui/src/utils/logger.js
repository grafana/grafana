import { throttle } from 'lodash';
/**
 * @internal
 * */
const throttledLog = throttle((...t) => {
    console.log(...t);
}, 500);
/** @internal */
export const createLogger = (name) => {
    let loggingEnabled = false;
    if (typeof window !== 'undefined') {
        loggingEnabled = window.localStorage.getItem('grafana.debug') === 'true';
    }
    return {
        logger: (id, throttle = false, ...t) => {
            if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test' || !loggingEnabled) {
                return;
            }
            const fn = throttle ? throttledLog : console.log;
            fn(`[${name}: ${id}]:`, ...t);
        },
        enable: () => (loggingEnabled = true),
        disable: () => (loggingEnabled = false),
        isEnabled: () => loggingEnabled,
    };
};
//# sourceMappingURL=logger.js.map