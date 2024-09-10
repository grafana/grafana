import { nanoid } from 'nanoid';
import { Observable, Subject } from 'rxjs';

enum LogLevel {
  info = 'info',
  warning = 'warning',
  error = 'error',
  debug = 'debug',
  trace = 'trace',
  fatal = 'fatal',
}

export type LogItem = {
  level: LogLevel;
  timestamp: number;
  labels: Record<string | symbol, unknown>;
  message: string;
  id: string;
};

const channelName = 'ui-extension-logs';

export class ExtensionsLog {
  private baseLabels: Record<string | symbol, unknown> | undefined;
  private subject: Subject<LogItem> | undefined;
  private channel: BroadcastChannel;

  constructor(baseLabels?: Record<string | symbol, unknown>) {
    this.baseLabels = baseLabels;
    this.channel = new BroadcastChannel(channelName);
  }

  info(message: string, labels?: LogItem['labels']): void {
    this.log(LogLevel.info, message, labels);
  }

  warning(message: string, labels?: LogItem['labels']): void {
    this.log(LogLevel.warning, message, labels);
  }

  error(message: string, labels?: LogItem['labels']): void {
    this.log(LogLevel.error, message, labels);
  }

  debug(message: string, labels?: LogItem['labels']): void {
    this.log(LogLevel.debug, message, labels);
  }

  trace(message: string, labels?: LogItem['labels']): void {
    this.log(LogLevel.trace, message, labels);
  }

  fatal(message: string, labels?: LogItem['labels']): void {
    this.log(LogLevel.fatal, message, labels);
  }

  private log(level: LogLevel, message: string, labels?: LogItem['labels']): void {
    const item: LogItem = {
      level: level,
      labels: {
        ...labels,
        ...this.baseLabels,
      },
      timestamp: Date.now(),
      id: nanoid(),
      message: message,
    };

    this.channel.postMessage(item);
  }

  asObservable(): Observable<LogItem> {
    if (!this.subject) {
      // Lazily create the subject on first subscription to prevent
      // to create buffers when no subscribers exists
      this.subject = new Subject<LogItem>();
      this.channel.onmessage = (msg: MessageEvent<LogItem>) => this.subject?.next(msg.data);
    }

    return this.subject.asObservable();
  }

  child(labels: Record<string | symbol, unknown>): ExtensionsLog {
    return new ExtensionsLog({
      ...labels,
      ...this.baseLabels,
    });
  }
}

export const log = new ExtensionsLog();
