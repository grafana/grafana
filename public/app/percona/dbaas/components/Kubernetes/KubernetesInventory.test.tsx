import { render, screen, waitForElementToBeRemoved } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';

import { configureStore } from 'app/store/configureStore';
import { StoreState } from 'app/types';

import { KubernetesService } from './Kubernetes.service';
import { KubernetesClusterStatus } from './KubernetesClusterStatus/KubernetesClusterStatus.types';
import { KubernetesInventory } from './KubernetesInventory';
import { KubernetesOperatorStatus } from './OperatorStatusItem/KubernetesOperatorStatus/KubernetesOperatorStatus.types';

jest.mock('app/core/app_events');
jest.mock('app/percona/dbaas/components/Kubernetes/Kubernetes.service');

describe('KubernetesInventory::', () => {
  it('renders table correctly', async () => {
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: { loading: false, result: { isConnectedToPortal: true, dbaasEnabled: true } },
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
                {
                  kubernetesClusterName: 'cluster2',
                  status: KubernetesClusterStatus.ok,
                  operators: {
                    psmdb: { status: KubernetesOperatorStatus.ok, version: '1', availableVersion: '1' },
                    pxc: { status: KubernetesOperatorStatus.ok, version: '1', availableVersion: '1' },
                  },
                },
              ],
            },
            addKubernetes: { loading: false },
            deleteKubernetes: { loading: false },
          },
        } as StoreState)}
      >
        <KubernetesInventory setMode={jest.fn} />
      </Provider>
    );

    await waitForElementToBeRemoved(() => screen.getByTestId('table-loading'));
    expect(screen.getAllByTestId('table-row')).toHaveLength(2);
  });

  it('shows portal k8s free cluster promoting message when user has no clusters', async () => {
    jest.spyOn(KubernetesService, 'getKubernetes').mockImplementation(() =>
      Promise.resolve({
        kubernetes_clusters: [],
      })
    );
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: { loading: false, result: { isConnectedToPortal: true, dbaasEnabled: true } },
            kubernetes: {
              loading: false,
            },
            addKubernetes: { loading: false },
            deleteKubernetes: { loading: false },
          },
        } as StoreState)}
      >
        <KubernetesInventory setMode={jest.fn} />
      </Provider>
    );

    expect(screen.queryByTestId('pmm-server-promote-portal-k8s-cluster-message')).not.toBeInTheDocument();
    await waitForElementToBeRemoved(() => screen.getByTestId('table-loading'));
    expect(screen.getByTestId('pmm-server-promote-portal-k8s-cluster-message')).toBeInTheDocument();
  });
});
