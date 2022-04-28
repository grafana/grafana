import React from 'react';
import { Provider } from 'react-redux';
import { StoreState } from 'app/types';
import { configureStore } from 'app/store/configureStore';
import { MetricsResolution } from './MetricsResolution';
import { defaultResolutions } from './MetricsResolution.constants';
import { removeUnits } from './MetricsResolution.utils';
import { fireEvent, render, screen } from '@testing-library/react';

describe('MetricsResolution::', () => {
  it('Renders correctly with props for standard resolution', () => {
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: {
              loading: false,
              result: { isConnectedToPortal: true, metricsResolutions: defaultResolutions[1] },
            },
          },
        } as StoreState)}
      >
        <MetricsResolution />
      </Provider>
    );

    const standardRes = removeUnits(defaultResolutions[1]);

    expect(screen.getByTestId('lr-number-input')).toHaveValue(+standardRes.lr);
    expect(screen.getByTestId('mr-number-input')).toHaveValue(+standardRes.mr);
    expect(screen.getByTestId('hr-number-input')).toHaveValue(+standardRes.hr);
  });

  it('Renders correctly with props for rare resolution', () => {
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: {
              loading: false,
              result: { isConnectedToPortal: true, metricsResolutions: defaultResolutions[0] },
            },
          },
        } as StoreState)}
      >
        <MetricsResolution />
      </Provider>
    );

    const standardRes = removeUnits(defaultResolutions[0]);

    expect(screen.getByTestId('lr-number-input')).toHaveValue(+standardRes.lr);
    expect(screen.getByTestId('mr-number-input')).toHaveValue(+standardRes.mr);
    expect(screen.getByTestId('hr-number-input')).toHaveValue(+standardRes.hr);
  });

  it('Renders correctly with props for frequent resolution', () => {
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: {
              loading: false,
              result: { isConnectedToPortal: true, metricsResolutions: defaultResolutions[2] },
            },
          },
        } as StoreState)}
      >
        <MetricsResolution />
      </Provider>
    );

    const standardRes = removeUnits(defaultResolutions[2]);

    expect(screen.getByTestId('lr-number-input')).toHaveValue(+standardRes.lr);
    expect(screen.getByTestId('mr-number-input')).toHaveValue(+standardRes.mr);
    expect(screen.getByTestId('hr-number-input')).toHaveValue(+standardRes.hr);
  });

  it('Changes input values when changing resolution', () => {
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: {
              loading: false,
              result: { isConnectedToPortal: true, metricsResolutions: defaultResolutions[0] },
            },
          },
        } as StoreState)}
      >
        <MetricsResolution />
      </Provider>
    );
    const radio = screen.getAllByTestId('resolutions-radio-button')[2];

    fireEvent.click(radio);

    const standardRes = removeUnits(defaultResolutions[2]);

    expect(screen.getByTestId('lr-number-input')).toHaveValue(+standardRes.lr);
    expect(screen.getByTestId('mr-number-input')).toHaveValue(+standardRes.mr);
    expect(screen.getByTestId('hr-number-input')).toHaveValue(+standardRes.hr);
  });

  it('Disables apply changes on initial values', () => {
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: {
              loading: false,
              result: { isConnectedToPortal: true, metricsResolutions: defaultResolutions[0] },
            },
          },
        } as StoreState)}
      >
        <MetricsResolution />
      </Provider>
    );
    const button = screen.getByTestId('metrics-resolution-button');

    expect(button).toBeDisabled();
  });
});
