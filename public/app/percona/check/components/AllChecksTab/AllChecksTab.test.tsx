import { logger } from '@percona/platform-core';
import { fireEvent, render, screen, waitFor, waitForElementToBeRemoved } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';

import { locationService } from '@grafana/runtime';
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
jest.mock('app/percona/check/Check.service');

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
        <Router history={locationService.getHistory()}>
          <AllChecksTab />
        </Router>
      </Provider>
    );

    await waitForElementToBeRemoved(() => screen.getByTestId('table-loading'));

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
        <Router history={locationService.getHistory()}>
          <AllChecksTab />
        </Router>
      </Provider>
    );

    expect(screen.queryByTestId('table-loading')).toBeInTheDocument();
    await waitForElementToBeRemoved(() => screen.getByTestId('table-loading'));
    expect(screen.queryByTestId('spinner-wrapper')).not.toBeInTheDocument();
  });

  it('should render a table', async () => {
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true, isPlatformUser: false },
            settings: { result: { sttEnabled: true, isConnectedToPortal: false } },
          },
        } as StoreState)}
      >
        <Router history={locationService.getHistory()}>
          <AllChecksTab />
        </Router>
      </Provider>
    );

    await waitForElementToBeRemoved(() => screen.getByTestId('table-loading'));
    const tbody = screen.getByTestId('table-tbody');

    expect(tbody.querySelectorAll('tr > td')).toHaveLength(2 * 5);
    expect(tbody.querySelectorAll('tr > td')[0]).toHaveTextContent('Test');
    expect(tbody.querySelectorAll('tr > td')[1]).toHaveTextContent('test enabled description');
    expect(tbody.querySelectorAll('tr > td')[2]).toHaveTextContent(Messages.enabled);
    expect(tbody.querySelectorAll('tr > td')[3]).toHaveTextContent(Interval.STANDARD);
    expect(tbody.querySelectorAll('tr > td')[4]).toHaveTextContent(Messages.disable);
    expect(tbody.querySelectorAll('tr > td')[5]).toHaveTextContent('Test disabled');
    expect(tbody.querySelectorAll('tr > td')[6]).toHaveTextContent('test disabled description');
    expect(tbody.querySelectorAll('tr > td')[7]).toHaveTextContent(Messages.disabled);
    expect(tbody.querySelectorAll('tr > td')[8]).toHaveTextContent(Interval.RARE);
    expect(tbody.querySelectorAll('tr > td')[9]).toHaveTextContent(Messages.enable);
  });

  it('should call an API to change the check status when the action button gets clicked', async () => {
    const spy = jest.spyOn(CheckService, 'changeCheck');
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true, isPlatformUser: false },
            settings: { result: { sttEnabled: true, isConnectedToPortal: false } },
          },
        } as StoreState)}
      >
        <Router history={locationService.getHistory()}>
          <AllChecksTab />
        </Router>
      </Provider>
    );

    await waitForElementToBeRemoved(() => screen.getByTestId('table-loading'));

    const button = screen.getAllByTestId('check-table-loader-button')[0];
    fireEvent.click(button);

    await waitFor(() => expect(button).toHaveTextContent('Enable'));

    expect(spy).toBeCalledTimes(1);
    expect(spy).toBeCalledWith({ params: [{ name: 'test enabled', disable: true }] });
    spy.mockClear();
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
        <Router history={locationService.getHistory()}>
          <AllChecksTab />
        </Router>
      </Provider>
    );

    await waitForElementToBeRemoved(() => screen.getByTestId('table-loading'));

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
        <Router history={locationService.getHistory()}>
          <AllChecksTab />
        </Router>
      </Provider>
    );

    await waitForElementToBeRemoved(() => screen.getByTestId('table-loading'));

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
