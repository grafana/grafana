import { throttle } from 'lodash';

/**
 * @internal
 * */
const throttledLog = throttle((...t: any[]) => {
  console.log(...t);
}, 500);

/**
 * @internal
 */
export interface Logger {
  logger: (...t: any[]) => void;
  enable: () => void;
  disable: () => void;
  isEnabled: () => boolean;
}

/** @internal */
export const createLogger = (name: string): Logger => {
  let loggingEnabled = false;

  if (typeof window !== 'undefined') {
    loggingEnabled = window.localStorage.getItem('grafana.debug') === 'true';
  }

  return {
    logger: (id: string, throttle = false, ...t: any[]) => {
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
