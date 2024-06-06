type LogItem = {
  level: 'info' | 'warn' | 'error';
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
  }

  warn(log: WarnLog) {
    this.logs.push({
      ...log,
      level: 'warn',
    });
  }

  error(log: ErrorLog) {
    this.logs.push({
      ...log,
      level: 'error',
    });
  }
}

export const registryLog = new RegistryLog();
