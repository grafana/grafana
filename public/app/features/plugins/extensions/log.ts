import { Observable, ReplaySubject } from 'rxjs';

enum LogLevel {
  info = 'info',
  warning = 'warning',
  error = 'error',
  debug = 'debug',
  trace = 'trace',
  fatal = 'fatal',
}

type LogItem = {
  level: LogLevel;
  ts: number;
  obj: LogEntry;
};

type LogEntry = string;
// type LogEntry = { entry: string; labels: Labels };
// type LogEntry = Record<string | symbol, string | symbol | number | boolean | object>;

const channelName = 'ui-extension-logs';
const windowTime = 1000 * 60 * 10;
const bufferSize = 1000;

export class ExtensionsLog {
  private subject: ReplaySubject<LogItem> | undefined;
  private channel: BroadcastChannel;

  constructor() {
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
      obj: entry,
      ts: Date.now(),
    };

    this.channel.postMessage(item);
  }

  asObservable(): Observable<LogItem> {
    if (!this.subject) {
      // Lazily create the subject on first subscription to prevent
      // to create buffers when no subscribers exists
      this.subject = new ReplaySubject<LogItem>(bufferSize, windowTime);
      this.channel.onmessage = (msg: MessageEvent<LogItem>) => this.subject?.next(msg.data);
    }

    return this.subject.asObservable();
  }

  child(): ExtensionsLog {
    return this;
  }
}
