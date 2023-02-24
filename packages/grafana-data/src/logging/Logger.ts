import { LogLevel, LogAppender } from './types';

export class Logger {
  private _level: LogLevel | null = null;

  constructor(public name: string, private _appender: LogAppender, private _parent: Logger | null) {}

  setLevel(level: LogLevel) {
    this._level = level;
  }

  debug(...args: unknown[]) {
    this._log(LogLevel.Debug, args);
  }

  isDebugEnabled() {
    return this.getInheritedLevel() >= LogLevel.Debug;
  }

  private getInheritedLevel(): LogLevel {
    if (this._level !== null) {
      return this._level;
    } else if (this._parent) {
      return this._parent.getInheritedLevel();
    }

    return LogLevel.Off;
  }

  private _log(level: LogLevel, args: unknown[]) {
    if (level < this.getInheritedLevel()) {
      return;
    }

    this._appender.append(this, level, args);
  }
}
