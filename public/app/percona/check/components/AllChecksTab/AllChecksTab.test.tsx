import { logger } from '@percona/platform-core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';

import { CheckService } from 'app/percona/check/Check.service';
import { Interval } from 'app/percona/check/types';
import { configureStore } from 'app/store/configureStore';
import { StoreState } from 'app/types';

import { AllChecksTab } from './AllChecksTab';
import { Messages } from './AllChecksTab.messages';

jest.mock('@percona/platform-core', () => {
  const originalModule = jest.requireActual('@percona/platform-core');
  return {
    ...originalModule,
    logger: {
      error: jest.fn(),
    },
  };
});

describe('AllChecksTab::', () => {
  beforeEach(() => jest.clearAllMocks());
  it('should fetch checks at startup', async () => {
    const spy = jest.spyOn(CheckService, 'getAllChecks');
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true, isPlatformUser: false },
            settings: { result: { sttEnabled: true, isConnectedToPortal: false } },
          },
        } as StoreState)}
      >
        <AllChecksTab />
      </Provider>
    );

    await screen.findByTestId('db-checks-all-checks-wrapper');

    expect(spy).toBeCalledTimes(1);
  });

  it('should render a spinner at startup, while loading', async () => {
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true, isPlatformUser: false },
            settings: { result: { sttEnabled: true, isConnectedToPortal: false } },
          },
        } as StoreState)}
      >
        <AllChecksTab />
      </Provider>
    );

    await screen.findByTestId('db-checks-all-checks-spinner');
    expect(screen.getByTestId('db-checks-all-checks-spinner')).toBeInTheDocument();
  });

  it('should log an error if the API call fails', async () => {
    jest.spyOn(CheckService, 'getAllChecks').mockImplementation(() => {
      throw Error('test');
    });
    const loggerSpy = jest.spyOn(logger, 'error').mockImplementationOnce(() => null);

    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true, isPlatformUser: false },
            settings: { result: { sttEnabled: true, isConnectedToPortal: false } },
          },
        } as StoreState)}
      >
        <AllChecksTab />
      </Provider>
    );

    await screen.findByTestId('db-checks-all-checks-wrapper');
    expect(loggerSpy).toBeCalledTimes(1);
  });

  it('should render a table', async () => {
    jest.spyOn(CheckService, 'getAllChecks').mockImplementation(() =>
      Promise.resolve([
        {
          summary: 'Test',
          name: 'test enabled',
          description: 'test enabled description',
          interval: 'STANDARD',
          disabled: false,
        },
        {
          summary: 'Test disabled',
          name: 'test disabled',
          description: 'test disabled description',
          interval: 'RARE',
          disabled: true,
        },
      ])
    );

    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true, isPlatformUser: false },
            settings: { result: { sttEnabled: true, isConnectedToPortal: false } },
          },
        } as StoreState)}
      >
        <AllChecksTab />
      </Provider>
    );

    await screen.findByTestId('db-checks-all-checks-wrapper');
    const cells = screen.getAllByRole('cell');

    expect(screen.getAllByTestId('db-checks-all-checks-table')).toHaveLength(1);
    expect(screen.getAllByTestId('db-checks-all-checks-thead')).toHaveLength(1);
    expect(screen.getAllByTestId('db-checks-all-checks-tbody')).toHaveLength(1);
    expect(cells).toHaveLength(10);
    expect(cells[0]).toHaveTextContent('Test');
    expect(cells[1]).toHaveTextContent('test enabled description');
    expect(cells[2]).toHaveTextContent(Messages.enabled);
    expect(cells[3]).toHaveTextContent(Interval.STANDARD);
    expect(cells[4]).toHaveTextContent(Messages.disable);
    expect(cells[5]).toHaveTextContent('Test disabled');
    expect(cells[6]).toHaveTextContent('test disabled description');
    expect(cells[7]).toHaveTextContent(Messages.disabled);
    expect(cells[8]).toHaveTextContent(Interval.RARE);
    expect(cells[9]).toHaveTextContent(Messages.enable);
  });

  it('should log an error if the run checks API call fails', async () => {
    jest.spyOn(CheckService, 'runDbChecks').mockImplementationOnce(() => {
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
        <AllChecksTab />
      </Provider>
    );

    await screen.findByTestId('db-check-panel-actions');

    const runChecksButton = screen.getByRole('button', { name: Messages.runDbChecks });

    await waitFor(() => fireEvent.click(runChecksButton));
    fireEvent.click(runChecksButton);
    expect(screen.queryByText('Run Checks')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(loggerSpy).toBeCalledTimes(1);
    });

    expect(await screen.findByText('Run Checks')).toBeInTheDocument();
  });

  it('should call the API to run checks when the "run checks" button gets clicked', async () => {
    const runChecksSpy = jest.spyOn(CheckService, 'runDbChecks');
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true, isPlatformUser: false },
            settings: { result: { sttEnabled: true, isConnectedToPortal: false } },
          },
        } as StoreState)}
      >
        <AllChecksTab />
      </Provider>
    );

    await screen.findByTestId('db-check-panel-actions');

    const runChecksButton = screen.getByRole('button', { name: Messages.runDbChecks });

    expect(runChecksSpy).toBeCalledTimes(0);
    fireEvent.click(runChecksButton);

    expect(screen.queryByText('Run Checks')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(runChecksSpy).toBeCalledTimes(1);
    });

    expect(await screen.findByText('Run Checks')).toBeInTheDocument();
  });
});
