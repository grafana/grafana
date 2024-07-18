import { render, screen, waitForElementToBeRemoved } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';

import { CheckService } from 'app/percona/check/Check.service';
import { logger } from 'app/percona/shared/helpers/logger';
import { wrapWithGrafanaContextMock } from 'app/percona/shared/helpers/testUtils';
import { configureStore } from 'app/store/configureStore';
import { StoreState } from 'app/types';

import { FailedChecksTab } from './FailedChecksTab';

jest.mock('app/percona/shared/helpers/logger', () => {
  const originalModule = jest.requireActual('app/percona/shared/helpers/logger');
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
            settings: { result: { advisorEnabled: true, isConnectedToPortal: false } },
          },
        } as StoreState)}
      >
        {wrapWithGrafanaContextMock(<FailedChecksTab />)}
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
            settings: { result: { advisorEnabled: true, isConnectedToPortal: false } },
          },
        } as StoreState)}
      >
        {wrapWithGrafanaContextMock(<FailedChecksTab />)}
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
            settings: { result: { advisorEnabled: true, isConnectedToPortal: false } },
          },
        } as StoreState)}
      >
        {wrapWithGrafanaContextMock(<FailedChecksTab />)}
      </Provider>
    );

    await waitForElementToBeRemoved(() => screen.getByTestId('table-loading'));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByTestId('table-no-data')).toBeInTheDocument();
  });
});
