import { render, screen, fireEvent, waitForElementToBeRemoved } from '@testing-library/react';
import { Provider } from 'react-redux';

import * as reducers from 'app/percona/shared/core/reducers';
import { wrapWithGrafanaContextMock } from 'app/percona/shared/helpers/testUtils';
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
                advisorRunIntervals: {
                  rareInterval: '280800s',
                  standardInterval: '86400s',
                  frequentInterval: '14400s',
                },
                dataRetention: '2592000s',
                telemetryEnabled: true,
                telemetrySummaries: ['summary1', 'summary2'],
                updatesEnabled: false,
                backupEnabled: false,
                advisorEnabled: true,
                azureDiscoverEnabled: true,
                publicAddress: 'localhost',
                alertingEnabled: true,
              },
            },
          },
        } as StoreState)}
      >
        {wrapWithGrafanaContextMock(<Advanced />)}
      </Provider>
    );

    expect(screen.getByTestId('retention-number-input')).toHaveValue(30);
    expect(screen.getByTestId('publicAddress-text-input')).toHaveValue('localhost');
  });

  it('Calls apply changes', async () => {
    const spy = jest.spyOn(reducers, 'updateSettingsAction');
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: {
              loading: false,
              result: {
                advisorRunIntervals: {
                  rareInterval: '280800s',
                  standardInterval: '86400s',
                  frequentInterval: '14400s',
                },
                dataRetention: '2592000s',
                telemetryEnabled: true,
                telemetrySummaries: ['summary1', 'summary2'],
                updatesEnabled: false,
                backupEnabled: false,
                advisorEnabled: true,
                azureDiscoverEnabled: true,
                publicAddress: 'localhost',
                alertingEnabled: true,
              },
            },
          },
        } as StoreState)}
      >
        {wrapWithGrafanaContextMock(<Advanced />)}
      </Provider>
    );
    fireEvent.change(screen.getByTestId('retention-number-input'), { target: { value: 70 } });
    fireEvent.submit(screen.getByTestId('advanced-button'));
    await waitForElementToBeRemoved(() => screen.getByTestId('Spinner'));

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
                advisorRunIntervals: {
                  rareInterval: '280800s',
                  standardInterval: '86400s',
                  frequentInterval: '14400s',
                },
                dataRetention: '2592000s',
                telemetryEnabled: true,
                telemetrySummaries: ['summary1', 'summary2'],
                updatesEnabled: false,
                backupEnabled: false,
                advisorEnabled: true,
                azureDiscoverEnabled: true,
                publicAddress: 'localhost',
                alertingEnabled: true,
              },
            },
          },
        } as StoreState)}
      >
        {wrapWithGrafanaContextMock(<Advanced />)}
      </Provider>
    );

    fireEvent.click(screen.getByTestId('public-address-button'));
    expect(screen.getByTestId('publicAddress-text-input')).toHaveValue('pmmtest.percona.com');
  });

  it('Does not include STT check intervals in the change request if STT checks are disabled', async () => {
    const spy = jest.spyOn(reducers, 'updateSettingsAction');

    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: {
              loading: false,
              result: {
                advisorRunIntervals: {
                  rareInterval: '280800s',
                  standardInterval: '86400s',
                  frequentInterval: '14400s',
                },
                dataRetention: '2592000s',
                telemetryEnabled: true,
                telemetrySummaries: ['summary1', 'summary2'],
                updatesEnabled: false,
                backupEnabled: false,
                advisorEnabled: false,
                azureDiscoverEnabled: true,
                publicAddress: 'localhost',
                alertingEnabled: true,
              },
            },
          },
        } as StoreState)}
      >
        {wrapWithGrafanaContextMock(<Advanced />)}
      </Provider>
    );

    fireEvent.change(screen.getByTestId('retention-number-input'), { target: { value: 70 } });
    fireEvent.submit(screen.getByTestId('advanced-button'));
    await waitForElementToBeRemoved(() => screen.getByTestId('Spinner'));

    // expect(spy.calls.mostRecent().args[0].body.stt_check_intervals).toBeUndefined();
    expect(spy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          advisor_run_intervals: undefined,
        }),
      })
    );
  });

  it('Includes STT check intervals in the change request if STT checks are enabled', async () => {
    const spy = jest.spyOn(reducers, 'updateSettingsAction');

    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: {
              loading: false,
              result: {
                advisorRunIntervals: {
                  rareInterval: '280800s',
                  standardInterval: '86400s',
                  frequentInterval: '14400s',
                },
                dataRetention: '2592000s',
                telemetryEnabled: true,
                telemetrySummaries: ['summary1', 'summary2'],
                updatesEnabled: false,
                backupEnabled: false,
                advisorEnabled: true,
                azureDiscoverEnabled: true,
                publicAddress: 'localhost',
                alertingEnabled: true,
              },
            },
          },
          navIndex: {},
        } as StoreState)}
      >
        {wrapWithGrafanaContextMock(<Advanced />)}
      </Provider>
    );

    fireEvent.change(screen.getByTestId('retention-number-input'), { target: { value: 70 } });
    fireEvent.submit(screen.getByTestId('advanced-button'));
    await waitForElementToBeRemoved(() => screen.getByTestId('Spinner'));

    // expect(spy.calls.mostRecent().args[0].body.stt_check_intervals).toBeDefined();
    expect(spy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          advisor_run_intervals: {
            frequent_interval: '14400s',
            rare_interval: '280800s',
            standard_interval: '86400s',
          },
        }),
      })
    );
  });
});
