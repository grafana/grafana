import { throttle } from 'lodash';

type Args = Parameters<typeof console.log>;

/**
 * @internal
 * */
const throttledLog = throttle((...t: Args) => {
  console.log(...t);
}, 500);

/**
 * @internal
 */
export interface Logger {
  logger: (...t: Args) => void;
  enable: () => void;
  disable: () => void;
  isEnabled: () => boolean;
}

/**
 * Configuration options for logger creation
 * @internal
 */
interface LoggerOptions {
  /** localStorage key to check for enabling debug mode. Defaults to 'grafana.debug' */
  storageKey?: string;
  /** Whether to support enable/disable methods that modify internal state. Defaults to true */
  enableToggle?: boolean;
}

/**
 * Core logger creation function with flexible configuration
 * @internal
 */
function createBaseLogger(name: string, options: LoggerOptions = {}) {
  const { storageKey = 'grafana.debug', enableToggle = true } = options;

  // For backward compatibility, createLogger uses internal state that can be toggled
  let internalLoggingEnabled = false;

  if (typeof window !== 'undefined') {
    internalLoggingEnabled = window.localStorage.getItem(storageKey) === 'true';
  }

  const isEnabled = () => {
    if (enableToggle) {
      // Legacy behavior: check internal state (can be overridden by enable/disable)
      return internalLoggingEnabled;
    } else {
      // New behavior: always check localStorage directly (more reliable)
      return typeof window !== 'undefined' && localStorage.getItem(storageKey) === 'true';
    }
  };

  const shouldLog = () => {
    return !(process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test' || !isEnabled());
  };

  return {
    isEnabled,
    shouldLog,
    internalState: enableToggle
      ? {
          enable: () => (internalLoggingEnabled = true),
          disable: () => (internalLoggingEnabled = false),
        }
      : null,
  };
}

/** @internal */
export const createLogger = (name: string, storageKey?: string): Logger => {
  const base = createBaseLogger(name, { storageKey, enableToggle: true });

  return {
    logger: (id: string, throttle = false, ...t: Args) => {
      if (!base.shouldLog()) {
        return;
      }
      const fn = throttle ? throttledLog : console.log;
      fn(`[${name}: ${id}]:`, ...t);
    },
    enable: base.internalState!.enable,
    disable: base.internalState!.disable,
    isEnabled: base.isEnabled,
  };
};
