type LogLevel = 'info' | 'warn' | 'error';

type LogItem = {
  level: LogLevel;
  message: string;
  error?: Error | unknown;
  pluginId: string;
};

type InfoLog = Omit<LogItem, 'level' | 'error'>;

type WarnLog = Omit<LogItem, 'level'>;

type ErrorLog = Omit<LogItem, 'level'>;

class RegistryLog {
  private logs: LogItem[];

  constructor() {
    this.logs = [];
  }

  info(log: InfoLog) {
    this.logs.push({
      ...log,
      level: 'info',
    });
    console.log(log.message);
  }

  warn(log: WarnLog) {
    this.logs.push({
      ...log,
      level: 'warn',
    });

    console.warn(log.message, log.error);
  }

  error(log: ErrorLog) {
    this.logs.push({
      ...log,
      level: 'error',
    });
    console.error(log.message, log.error);
  }
}

export const registryLog = new RegistryLog();
