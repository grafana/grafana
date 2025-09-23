import { ExtensionsLog } from './log';

export function createLogMock(): ExtensionsLog {
  const { log: original } = jest.requireActual('./log');

  const logMock = {
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn(),
  };

  logMock.child.mockReturnValue(logMock);

  return {
    ...original,
    ...logMock,
  };
}

export function resetLogMock(log: ExtensionsLog): void {
  jest.mocked(log.error).mockReset();
  jest.mocked(log.warning).mockReset();
  jest.mocked(log.info).mockReset();
  jest.mocked(log.debug).mockReset();
  jest.mocked(log.trace).mockReset();
  jest.mocked(log.fatal).mockReset();
}
