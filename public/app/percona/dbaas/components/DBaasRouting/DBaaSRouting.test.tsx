import React from 'react';
import { render, screen } from '@testing-library/react';
import DBaaSRouting from './DBaaSRouting';
import { configureStore } from '../../../../store/configureStore';
import { StoreState } from '../../../../types';
import { Provider } from 'react-redux';
import { KubernetesClusterStatus } from '../Kubernetes/KubernetesClusterStatus/KubernetesClusterStatus.types';
import { KubernetesOperatorStatus } from '../Kubernetes/OperatorStatusItem/KubernetesOperatorStatus/KubernetesOperatorStatus.types';
import { locationService } from '@grafana/runtime/src';
import { Router } from 'react-router-dom';

describe('SwitchField::', () => {
  it('should show loading when we are waiting kubernetes response', () => {
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: { result: { dbaasEnabled: true } },
            kubernetes: {
              loading: true,
            },
          },
        } as StoreState)}
      >
        <DBaaSRouting />
      </Provider>
    );

    expect(screen.getByTestId('spinner-wrapper')).toBeInTheDocument();
  });

  it('should return redirect to /dbclusters  if we have one or more kubernetes clusters', async () => {
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: { result: { dbaasEnabled: true } },
            kubernetes: {
              loading: false,
              result: [
                {
                  kubernetesClusterName: 'cluster1',
                  status: KubernetesClusterStatus.ok,
                  operators: {
                    psmdb: { status: KubernetesOperatorStatus.ok, version: '1', availableVersion: '1' },
                    pxc: { status: KubernetesOperatorStatus.ok, version: '1', availableVersion: '1' },
                  },
                },
              ],
            },
          },
        } as StoreState)}
      >
        <Router history={locationService.getHistory()}>
          <DBaaSRouting />
        </Router>
      </Provider>
    );

    expect(locationService.getLocation().pathname).toBe('/dbaas/dbclusters');
  });

  it('should return redirect to /kubernetes  if we have one or more kubernetes clusters', async () => {
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: { result: { dbaasEnabled: true } },
            kubernetes: {
              loading: false,
            },
          },
        } as StoreState)}
      >
        <Router history={locationService.getHistory()}>
          <DBaaSRouting />
        </Router>
      </Provider>
    );

    expect(locationService.getLocation().pathname).toBe('/dbaas/kubernetes');
  });
});
