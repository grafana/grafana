import { type LoggerSource, setLogger } from '@grafana/runtime/unstable';

export function mockLogger(source: LoggerSource) {
  setLogger(source, {
    logDebug: jest.fn(),
    logError: jest.fn(),
    logInfo: jest.fn(),
    logWarning: jest.fn(),
    logMeasurement: jest.fn(),
  });
}
