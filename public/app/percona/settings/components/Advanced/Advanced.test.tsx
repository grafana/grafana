import React from 'react';
import { Provider } from 'react-redux';
import { StoreState } from 'app/types';
import { configureStore } from 'app/store/configureStore';
import { render, screen, fireEvent, waitForElementToBeRemoved } from '@testing-library/react';
import * as reducers from 'app/percona/shared/core/reducers';
import { Advanced } from './Advanced';

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
    const spy = spyOn(reducers, 'updateSettingsAction').and.callThrough();
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
    const spy = spyOn(reducers, 'updateSettingsAction').and.callThrough();

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

    expect(spy.calls.mostRecent().args[0].body.stt_check_intervals).toBeUndefined();
  });

  it('Includes STT check intervals in the change request if STT checks are enabled', async () => {
    const spy = spyOn(reducers, 'updateSettingsAction').and.callThrough();

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

    expect(spy.calls.mostRecent().args[0].body.stt_check_intervals).toBeDefined();
  });
});
