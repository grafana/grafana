import React from 'react';
import { logger } from '@percona/platform-core';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { CheckService } from 'app/percona/check/Check.service';
import { FailedChecksTab } from './FailedChecksTab';

jest.mock('@percona/platform-core', () => {
  const originalModule = jest.requireActual('@percona/platform-core');
  return {
    ...originalModule,
    logger: {
      error: jest.fn(),
    },
  };
});

describe('FailedChecksTab::', () => {
  let getAlertsSpy = jest.spyOn(CheckService, 'getActiveAlerts').mockImplementation(() => Promise.resolve([]));

  afterEach(() => getAlertsSpy.mockClear());

  it('should fetch active alerts at startup', async () => {
    act(() => {
      render(<FailedChecksTab />);
    });

    await screen.findByTestId('db-checks-failed-checks-toggle-silenced');
    expect(CheckService.getActiveAlerts).toHaveBeenCalledTimes(1);
  });

  it('should render a spinner at startup, while loading', async () => {
    act(() => {
      render(<FailedChecksTab />);
    });

    expect(screen.queryByTestId('db-checks-failed-checks-spinner')).toBeInTheDocument();

    await screen.findByTestId('db-checks-failed-checks-toggle-silenced');

    expect(screen.queryByTestId('db-checks-failed-checks-spinner')).not.toBeInTheDocument();
  });

  it('should log an error if the fetch alerts API call fails', async () => {
    getAlertsSpy.mockImplementationOnce(() => {
      throw Error('test');
    });
    const loggerSpy = jest.spyOn(logger, 'error');

    act(() => {
      render(<FailedChecksTab />);
    });

    await screen.findByTestId('db-checks-failed-checks-toggle-silenced');

    expect(loggerSpy).toBeCalledTimes(1);

    loggerSpy.mockClear();
  });

  it('should log an error if the run checks API call fails', async () => {
    getAlertsSpy.mockImplementationOnce(() => {
      throw Error('test');
    });
    const loggerSpy = jest.spyOn(logger, 'error');

    act(() => {
      render(<FailedChecksTab />);
    });

    await screen.findByTestId('db-checks-failed-checks-toggle-silenced');

    const runChecksButton = screen.getByRole('button');

    fireEvent.click(runChecksButton);

    expect(loggerSpy).toBeCalledTimes(1);
    loggerSpy.mockClear();
  });

  it('should call the API to run checks when the "run checks" button gets clicked', async () => {
    const runChecksSpy = jest.spyOn(CheckService, 'runDbChecks');
    act(() => {
      render(<FailedChecksTab />);
    });

    await screen.findByTestId('db-checks-failed-checks-toggle-silenced');

    const runChecksButton = screen.getByRole('button');

    expect(runChecksSpy).toBeCalledTimes(0);
    fireEvent.click(runChecksButton);
    expect(runChecksSpy).toBeCalledTimes(1);

    runChecksSpy.mockClear();
  });

  it('should render a table after having fetched the alerts', async () => {
    act(() => {
      render(<FailedChecksTab />);
    });

    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    await screen.findByTestId('db-checks-failed-checks-toggle-silenced');

    expect(screen.queryByTestId('db-check-panel-table-empty')).toBeInTheDocument();
  });
});
