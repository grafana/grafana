import { createMonitoringLogger, type MonitoringLogger } from '../../utils/logging';

import { Loggers, type LoggerDefaults, type LoggerSource } from './loggers';

let loggersRegistry: Partial<Record<LoggerSource, MonitoringLogger>> = {};

export function initializeLoggersRegistry() {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const entries = Object.entries(Loggers) as Array<[LoggerSource, LoggerDefaults]>;
  for (const [source, defaults] of entries) {
    addLogger(source, defaults);
  }
}

export function addLogger(source: LoggerSource, defaults?: LoggerDefaults): void {
  if (loggersRegistry[source]) {
    console.warn(`LoggerRegistry: a logger with the source:${source} already exists, keeping existing entry.`);
    return;
  }

  loggersRegistry[source] = createMonitoringLogger(source, defaults?.context, defaults?.logToConsole);
}

export function getLogger(source: LoggerSource): MonitoringLogger {
  if (!loggersRegistry[source]) {
    const message = `LoggerRegistry: no logger '${source}' exists, are you calling getLogger before initializeLoggersRegistry function was called?`;
    console.warn(message);

    if (process.env.NODE_ENV === 'development') {
      throw new Error(message);
    }

    return createMonitoringLogger(source);
  }

  return loggersRegistry[source];
}

export function setLogger(source: LoggerSource, logger: MonitoringLogger): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('LoggerRegistry: setLogger function can only be called from tests.');
  }

  loggersRegistry[source] = logger;
}

export function clearLoggerRegistry() {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('LoggerRegistry: clearLoggerRegistry function can only be called from tests.');
  }

  loggersRegistry = {};
}
