import { Logger } from './Logger';
import { LogAppender, LogLevel } from './types';

export class CompositeAppender implements LogAppender {
  private _appenders: LogAppender[] = [];

  add(appender: LogAppender) {
    this._appenders.push(appender);
  }

  remove(appender: LogAppender) {
    this._appenders = this._appenders.filter((a) => a !== appender);
  }

  append(logger: Logger, level: LogLevel, args: unknown[]): void {
    for (let i = 0; i < this._appenders.length; i++) {
      this._appenders[i].append(logger, level, args);
    }
  }
}

export class ConsoleAppender implements LogAppender {
  append(logger: Logger, level: LogLevel, args: unknown[]): void {
    if (level === LogLevel.Debug) {
      // eslint-disable-next-line no-console
      console.debug(`[${logger.name}]`, ...args);
    }
  }
}
