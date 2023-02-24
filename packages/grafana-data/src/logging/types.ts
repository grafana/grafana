import { Logger } from './Logger';

export const enum LogLevel {
  Debug = 1,
  Info = 2,
  Warn = 3,
  Error = 4,
  Off = 5,
}

const levelNames = {
  [LogLevel.Debug]: 'DEBUG',
  [LogLevel.Info]: 'INFO',
  [LogLevel.Warn]: 'WARN',
  [LogLevel.Error]: 'ERROR',
  [LogLevel.Off]: 'OFF',
};

export interface LogAppender {
  append(logger: Logger, level: LogLevel, args: unknown[]): void;
}

export interface LoggingConfig {
  loggers: Record<string, LogLevel>;
}

/**
 * Usefull for unit tests
 */
export class ArrayAppender implements LogAppender {
  logs: string[] = [];

  append(logger: Logger, level: LogLevel, args: unknown[]): void {
    this.logs.push(`[${levelNames[level]}] ${logger.name}: ${args.join(' ')}`);
  }

  clear() {
    this.logs = [];
  }
}
