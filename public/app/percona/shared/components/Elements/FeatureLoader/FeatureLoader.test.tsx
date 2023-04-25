import { render, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';

import { configureStore } from 'app/store/configureStore';
import { StoreState } from 'app/types';

import { FeatureLoader } from './FeatureLoader';

jest.mock('app/percona/shared/helpers/logger', () => {
  const originalModule = jest.requireActual('app/percona/shared/helpers/logger');
  return {
    ...originalModule,
    logger: {
      error: jest.fn(),
    },
  };
});

describe('FeatureLoader', () => {
  it('should not have children while loading settings', async () => {
    const { container } = render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: { loading: true, result: { isConnectedToPortal: true, alertingEnabled: true } },
          },
        } as StoreState)}
      >
        <FeatureLoader featureName="IA" featureSelector={(state) => !!state.percona.settings.result?.alertingEnabled}>
          <span>Dummy</span>
        </FeatureLoader>
      </Provider>
    );
    expect(container.querySelector('.fa-spin')).toBeInTheDocument();
    expect(screen.queryByText('Dummy')).not.toBeInTheDocument();
  });

  it('should show children after loading settings', async () => {
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: { loading: false, result: { isConnectedToPortal: true, alertingEnabled: true } },
          },
        } as StoreState)}
      >
        <FeatureLoader featureName="IA" featureSelector={(state) => !!state.percona.settings.result?.alertingEnabled}>
          <span>Dummy</span>
        </FeatureLoader>
      </Provider>
    );

    expect(screen.getByText('Dummy')).toBeInTheDocument();
  });

  it('should show insufficient access permissions message', async () => {
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: false },
            settings: { loading: false, result: { isConnectedToPortal: true, alertingEnabled: false } },
          },
        } as StoreState)}
      >
        <FeatureLoader featureName="IA" featureSelector={(state) => !!state.percona.settings.result?.alertingEnabled}>
          <span>Dummy</span>
        </FeatureLoader>
      </Provider>
    );

    expect(screen.getByTestId('unauthorized')).toBeInTheDocument();
  });

  it('should show a disabled feature message ', async () => {
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: { loading: false, result: { isConnectedToPortal: true, alertingEnabled: false } },
          },
        } as StoreState)}
      >
        <FeatureLoader featureName="IA" featureSelector={(state) => !!state.percona.settings.result?.alertingEnabled}>
          <span>Dummy</span>
        </FeatureLoader>
      </Provider>
    );

    expect(screen.getByTestId('settings-link')).toBeInTheDocument();
  });

  it('should show a generic disabled message when feature name is not passed', async () => {
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: { loading: false, result: { isConnectedToPortal: true, alertingEnabled: false } },
          },
        } as StoreState)}
      >
        <FeatureLoader featureSelector={(state) => !!state.percona.settings.result?.alertingEnabled}>
          <span>Dummy</span>
        </FeatureLoader>
      </Provider>
    );

    expect(screen.queryByTestId('settings-link')).not.toBeInTheDocument();
    expect(screen.getByText('Feature is disabled.')).toBeInTheDocument();
  });
});
