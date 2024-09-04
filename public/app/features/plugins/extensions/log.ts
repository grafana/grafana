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
  ts: number;
  obj: Record<string, unknown>;
  message: string;
  id: string;
};

type LogEntry = string;
// type LogEntry = { entry: string; labels: Labels };
// type LogEntry = Record<string | symbol, string | symbol | number | boolean | object>;

const channelName = 'ui-extension-logs';

export class ExtensionsLog {
  private baseLabels: Record<string | symbol, unknown> | undefined;
  private subject: Subject<LogItem> | undefined;
  private channel: BroadcastChannel;

  constructor(baseLabels?: Record<string | symbol, unknown>) {
    this.baseLabels = baseLabels;
    this.channel = new BroadcastChannel(channelName);
  }

  info(entry: LogEntry): void {
    this.log(LogLevel.info, entry);
  }

  warning(entry: LogEntry): void {
    this.log(LogLevel.warning, entry);
  }

  error(entry: LogEntry): void {
    this.log(LogLevel.error, entry);
  }

  debug(entry: LogEntry): void {
    this.log(LogLevel.debug, entry);
  }

  trace(entry: LogEntry): void {
    this.log(LogLevel.trace, entry);
  }

  fatal(entry: LogEntry): void {
    this.log(LogLevel.fatal, entry);
  }

  private log(level: LogLevel, entry: LogEntry): void {
    const item: LogItem = {
      level: level,
      obj: {
        ...this.baseLabels,
      },
      ts: Date.now(),
      id: nanoid(),
      message: entry,
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
