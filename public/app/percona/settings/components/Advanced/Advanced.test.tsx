import { render, screen, fireEvent, waitForElementToBeRemoved } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';

import * as reducers from 'app/percona/shared/core/reducers';
import { configureStore } from 'app/store/configureStore';
import { StoreState } from 'app/types';

import { Advanced } from './Advanced';

jest.mock('app/percona/settings/Settings.service');

describe('Advanced::', () => {
  it('Renders correctly with props', () => {
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: {
              loading: false,
              result: {
                sttCheckIntervals: { rareInterval: '280800s', standardInterval: '86400s', frequentInterval: '14400s' },
                dataRetention: '2592000s',
                telemetryEnabled: true,
                telemetrySummaries: ['summary1', 'summary2'],
                updatesDisabled: true,
                backupEnabled: false,
                sttEnabled: true,
                dbaasEnabled: false,
                azureDiscoverEnabled: true,
                publicAddress: 'localhost',
                alertingEnabled: true,
              },
            },
          },
        } as StoreState)}
      >
        <Advanced />
      </Provider>
    );

    expect(screen.getByTestId('retention-number-input')).toHaveValue(30);
    expect(screen.getByTestId('publicAddress-text-input')).toHaveValue('localhost');
  });

  it('Calls apply changes', async () => {
    const spy = jest.spyOn(reducers, 'updateSettingsAction');
    const { container } = render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: {
              loading: false,
              result: {
                sttCheckIntervals: { rareInterval: '280800s', standardInterval: '86400s', frequentInterval: '14400s' },
                dataRetention: '2592000s',
                telemetryEnabled: true,
                telemetrySummaries: ['summary1', 'summary2'],
                updatesDisabled: true,
                backupEnabled: false,
                sttEnabled: true,
                dbaasEnabled: false,
                azureDiscoverEnabled: true,
                publicAddress: 'localhost',
                alertingEnabled: true,
              },
            },
          },
        } as StoreState)}
      >
        <Advanced />
      </Provider>
    );
    fireEvent.change(screen.getByTestId('retention-number-input'), { target: { value: 70 } });
    fireEvent.submit(screen.getByTestId('advanced-button'));
    await waitForElementToBeRemoved(() => container.querySelector('.fa-spin'));

    expect(spy).toHaveBeenCalled();
  });

  it('Sets correct URL from browser', async () => {
    const location = {
      ...window.location,
      host: 'pmmtest.percona.com',
    };

    Object.defineProperty(window, 'location', {
      writable: true,
      value: location,
    });

    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: {
              loading: false,
              result: {
                sttCheckIntervals: { rareInterval: '280800s', standardInterval: '86400s', frequentInterval: '14400s' },
                dataRetention: '2592000s',
                telemetryEnabled: true,
                telemetrySummaries: ['summary1', 'summary2'],
                updatesDisabled: true,
                backupEnabled: false,
                sttEnabled: true,
                dbaasEnabled: false,
                azureDiscoverEnabled: true,
                publicAddress: 'localhost',
                alertingEnabled: true,
              },
            },
          },
        } as StoreState)}
      >
        <Advanced />
      </Provider>
    );

    fireEvent.click(screen.getByTestId('public-address-button'));
    expect(screen.getByTestId('publicAddress-text-input')).toHaveValue('pmmtest.percona.com');
  });

  it('Does not include STT check intervals in the change request if STT checks are disabled', async () => {
    const spy = jest.spyOn(reducers, 'updateSettingsAction');

    const { container } = render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: {
              loading: false,
              result: {
                sttCheckIntervals: { rareInterval: '280800s', standardInterval: '86400s', frequentInterval: '14400s' },
                dataRetention: '2592000s',
                telemetryEnabled: true,
                telemetrySummaries: ['summary1', 'summary2'],
                updatesDisabled: true,
                backupEnabled: false,
                sttEnabled: false,
                dbaasEnabled: false,
                azureDiscoverEnabled: true,
                publicAddress: 'localhost',
                alertingEnabled: true,
              },
            },
          },
        } as StoreState)}
      >
        <Advanced />
      </Provider>
    );

    fireEvent.change(screen.getByTestId('retention-number-input'), { target: { value: 70 } });
    fireEvent.submit(screen.getByTestId('advanced-button'));
    await waitForElementToBeRemoved(() => container.querySelector('.fa-spin'));

    // expect(spy.calls.mostRecent().args[0].body.stt_check_intervals).toBeUndefined();
    expect(spy).toHaveBeenLastCalledWith(
      expect.objectContaining({ body: expect.objectContaining({ stt_check_intervals: undefined }) })
    );
  });

  it('Includes STT check intervals in the change request if STT checks are enabled', async () => {
    const spy = jest.spyOn(reducers, 'updateSettingsAction');

    const { container } = render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: {
              loading: false,
              result: {
                sttCheckIntervals: { rareInterval: '280800s', standardInterval: '86400s', frequentInterval: '14400s' },
                dataRetention: '2592000s',
                telemetryEnabled: true,
                telemetrySummaries: ['summary1', 'summary2'],
                updatesDisabled: true,
                backupEnabled: false,
                sttEnabled: true,
                dbaasEnabled: false,
                azureDiscoverEnabled: true,
                publicAddress: 'localhost',
                alertingEnabled: true,
              },
            },
          },
          navIndex: {},
        } as StoreState)}
      >
        <Advanced />
      </Provider>
    );

    fireEvent.change(screen.getByTestId('retention-number-input'), { target: { value: 70 } });
    fireEvent.submit(screen.getByTestId('advanced-button'));
    await waitForElementToBeRemoved(() => container.querySelector('.fa-spin'));

    // expect(spy.calls.mostRecent().args[0].body.stt_check_intervals).toBeDefined();
    expect(spy).toHaveBeenLastCalledWith(
      expect.objectContaining({ body: expect.objectContaining({ stt_check_intervals: expect.anything() }) })
    );
  });
  it('Sets correct URL when DBaaS switched to checked mode', async () => {
    const location = {
      ...window.location,
      host: 'pmmtest.percona.com',
    };

    Object.defineProperty(window, 'location', {
      writable: true,
      value: location,
    });

    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: {
              loading: false,
              result: {
                sttCheckIntervals: { rareInterval: '280800s', standardInterval: '86400s', frequentInterval: '14400s' },
                dataRetention: '2592000s',
                telemetryEnabled: true,
                telemetrySummaries: ['summary1', 'summary2'],
                updatesDisabled: true,
                backupEnabled: false,
                sttEnabled: true,
                dbaasEnabled: false,
                azureDiscoverEnabled: true,
                publicAddress: '',
                alertingEnabled: true,
              },
            },
          },
        } as StoreState)}
      >
        <Advanced />
      </Provider>
    );

    const input = screen.getByTestId('advanced-dbaas').querySelector('input');

    expect(screen.getByTestId('advanced-dbaas').querySelector('input')).not.toBeChecked();
    expect(screen.getByTestId('publicAddress-text-input')).toHaveValue('');
    if (input) {
      fireEvent.click(input);
    }
    expect(screen.getByTestId('advanced-dbaas').querySelector('input')).toBeChecked();
    expect(screen.getByTestId('publicAddress-text-input')).toHaveValue('pmmtest.percona.com');
  });
});
