import { type MonitoringLogger } from '@grafana/runtime';
import { getLogger, type LoggerSource, setLogger } from '@grafana/runtime/unstable';

export function mockLogger(source: LoggerSource): MonitoringLogger {
  setLogger(source, {
    logDebug: jest.fn(),
    logError: jest.fn(),
    logInfo: jest.fn(),
    logWarning: jest.fn(),
    logMeasurement: jest.fn(),
  });
  return getLogger(source);
}
