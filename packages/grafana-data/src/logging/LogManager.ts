import { ConsoleAppender, CompositeAppender } from './Appenders';
import { Logger } from './Logger';
import { LogAppender, LoggingConfig, LogLevel } from './types';

export class LogManager {
  private _root = new Logger('', new ConsoleAppender(), null);
  private _loggers: Record<string, Logger> = {};
  private _loggerNameSeparator = '/';
  private _compositeAppender = new CompositeAppender();
  private _appenders: Record<string, LogAppender> = {};

  constructor() {
    this.registerAppender('console', new ConsoleAppender());
  }

  private _config: LoggingConfig = {
    loggers: {},
  };

  getLogger(name: string) {
    return this._loggers[name] || this._createLogger(name);
  }

  private _createLogger(name: string) {
    const parent = this._getParentLogger(name);
    const logger = new Logger(name, this._compositeAppender, parent);

    this._configureLogger(logger);
    this._loggers[name] = logger;

    return logger;
  }

  private _getParentLogger(childName: string): Logger {
    const parentName = this._getParentLoggerName(childName);
    return parentName ? this.getLogger(parentName) : this._root;
  }

  private _getParentLoggerName(childName: string): string | null {
    const path = childName.split(this._loggerNameSeparator);
    path.pop();

    if (path.length === 0) {
      return null;
    }

    return path.join(this._loggerNameSeparator);
  }

  private _configureLogger(logger: Logger) {
    logger.setLevel(this._config.loggers[logger.name] ?? null);
  }

  registerAppender(name: string, appender: LogAppender) {
    this._compositeAppender.add(appender);
    this._appenders[name] = appender;
  }

  removeAppender(name: string) {
    const appender = this._appenders[name];
    if (!appender) {
      throw new Error(`Appender not found ${name}`);
    }

    this._compositeAppender.remove(appender);
  }

  /**
   * Useful from the command line.
   * Example: window.grafanaLogging.setLoggerLevel("grafana", "debug")
   */
  setLoggerLevel(name: string, level: LogLevel | string) {
    if (typeof level === 'string') {
      level = getLogLevelFromName(level);
    }

    this._config.loggers[name] = level;

    const logger = this.getLogger(name);

    if (logger) {
      this._configureLogger(logger);
    }
  }

  updateConfig(config: LoggingConfig) {
    this._config = config;

    for (const logger of Object.values(this._loggers)) {
      this._configureLogger(logger);
    }
  }
}

export function getLogLevelFromName(name: string): LogLevel {
  switch (name.toLowerCase()) {
    case 'debug':
      return LogLevel.Debug;
    case 'info':
      return LogLevel.Info;
    case 'warn':
      return LogLevel.Warn;
    case 'error':
      return LogLevel.Error;
    case 'off':
      return LogLevel.Off;
  }

  throw new Error('Unknown log level: ' + name);
}

export const frontendLogging = new LogManager();
