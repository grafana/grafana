import { logger } from '@percona/platform-core';
import { render, screen, waitForElementToBeRemoved } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';

import { CheckService } from 'app/percona/check/Check.service';
import { configureStore } from 'app/store/configureStore';
import { StoreState } from 'app/types';

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
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true, isPlatformUser: false },
            settings: { result: { sttEnabled: true, isConnectedToPortal: false } },
          },
        } as StoreState)}
      >
        <FailedChecksTab />
      </Provider>
    );

    await waitForElementToBeRemoved(() => screen.getByTestId('table-loading'));
    expect(CheckService.getAllFailedChecks).toHaveBeenCalledTimes(1);
  });

  it('should log an error if the fetch alerts API call fails', async () => {
    getAlertsSpy.mockImplementationOnce(() => {
      throw Error('test');
    });
    const loggerSpy = jest.spyOn(logger, 'error');

    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true, isPlatformUser: false },
            settings: { result: { sttEnabled: true, isConnectedToPortal: false } },
          },
        } as StoreState)}
      >
        <FailedChecksTab />
      </Provider>
    );

    expect(loggerSpy).toBeCalledTimes(1);
    loggerSpy.mockClear();
  });

  it('should render a table after having fetched the alerts', async () => {
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true, isPlatformUser: false },
            settings: { result: { sttEnabled: true, isConnectedToPortal: false } },
          },
        } as StoreState)}
      >
        <FailedChecksTab />
      </Provider>
    );

    await waitForElementToBeRemoved(() => screen.getByTestId('table-loading'));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByTestId('table-no-data')).toBeInTheDocument();
  });
});
