import { render, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';

import { locationService } from '@grafana/runtime/src';

import { configureStore } from '../../../../store/configureStore';
import { StoreState } from '../../../../types';
import { KubernetesClusterStatus } from '../Kubernetes/KubernetesClusterStatus/KubernetesClusterStatus.types';
import { KubernetesOperatorStatus } from '../Kubernetes/OperatorStatusItem/KubernetesOperatorStatus/KubernetesOperatorStatus.types';

import DBaaSRouting from './DBaaSRouting';

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

    expect(screen.getByTestId('Spinner')).toBeInTheDocument();
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
