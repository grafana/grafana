import React from 'react';
import { logger } from '@percona/platform-core';
import { render, screen, waitFor } from '@testing-library/react';
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
  let getAlertsSpy = jest.spyOn(CheckService, 'getAllFailedChecks').mockImplementation(() => Promise.resolve([]));

  afterEach(() => getAlertsSpy.mockClear());

  it('should fetch active alerts at startup', async () => {
    await waitFor(() => render(<FailedChecksTab />));

    expect(CheckService.getAllFailedChecks).toHaveBeenCalledTimes(1);
  });

  it('should render a spinner at startup, while loading', async () => {
    render(<FailedChecksTab />);

    expect(screen.queryByTestId('db-checks-failed-checks-spinner')).toBeInTheDocument();
  });

  it('should log an error if the fetch alerts API call fails', async () => {
    getAlertsSpy.mockImplementationOnce(() => {
      throw Error('test');
    });
    const loggerSpy = jest.spyOn(logger, 'error');

    await waitFor(() => render(<FailedChecksTab />));

    expect(loggerSpy).toBeCalledTimes(1);

    loggerSpy.mockClear();
  });

  it('should render a table after having fetched the alerts', async () => {
    await render(<FailedChecksTab />);

    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    expect(screen.queryByTestId('table-no-data')).toBeInTheDocument();
  });
});
