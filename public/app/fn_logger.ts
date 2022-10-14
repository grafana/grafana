import { isBoolean, noop } from 'lodash';

const SHOULD_LOG = process.env.NODE_ENV !== 'production';

type Console = Pick<typeof console, 'info' | 'error' | 'debug' | 'warn' | 'log'>;

export class FnLoggerService {
  private static readonly DEFAULT_SHOULD_LOG = false;

  private static logger(shouldLog: boolean | null) {
    /* eslint-disable-next-line  */
    const flag = isBoolean(shouldLog)
      ? shouldLog
      : isBoolean(SHOULD_LOG)
      ? SHOULD_LOG
      : FnLoggerService.DEFAULT_SHOULD_LOG;

    if (flag) {
      return console as Console;
    }

    const noopConsole: Console = {
      info: noop,
      error: noop,
      debug: noop,
      warn: noop,
      log: noop,
    };

    return noopConsole;
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  static debug = (shouldLog: boolean | null, ...args: any[]) => {
    FnLoggerService.logger(shouldLog).debug(FnLoggerService.valuesToString(...args));
  };

  static error = (shouldLog: boolean | null, ...args: any[]) => {
    FnLoggerService.logger(shouldLog).error(FnLoggerService.valuesToString(...args));
  };

  static warn = (shouldLog: boolean | null, ...args: any[]) => {
    FnLoggerService.logger(shouldLog).warn(FnLoggerService.valuesToString(...args));
  };

  static info = (shouldLog: boolean | null, ...args: any[]) => {
    FnLoggerService.logger(shouldLog).info(FnLoggerService.valuesToString(...args));
  };

  static log = (shouldLog: boolean | null, ...args: any[]) => {
    FnLoggerService.logger(shouldLog).log(FnLoggerService.valuesToString(...args));
  };
  /* eslint-enable @typescript-eslint/no-explicit-any */

  /* eslint-disable @typescript-eslint/no-explicit-any */
  private static readonly valuesToString = (...args: any[]): string =>
    args.map(FnLoggerService.valueToString).join(' ');
  /* eslint-enable @typescript-eslint/no-explicit-any */

  private static readonly valueToString = <V>(value: V): string => {
    if (typeof value === 'string') {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map(FnLoggerService.valueToString).join(' ');
    }

    if (value instanceof Error) {
      return value.message;
    }

    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  };
}
