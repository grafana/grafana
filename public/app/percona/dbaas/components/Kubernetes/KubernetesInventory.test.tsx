import React from 'react';
import { Provider } from 'react-redux';
import { StoreState } from 'app/types';
import { configureStore } from 'app/store/configureStore';
import { render, screen, waitForElementToBeRemoved } from '@testing-library/react';
import { KubernetesInventory } from './KubernetesInventory';
import { KubernetesClusterStatus } from './KubernetesClusterStatus/KubernetesClusterStatus.types';
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
        <KubernetesInventory />
      </Provider>
    );

    await waitForElementToBeRemoved(() => screen.getByTestId('table-loading'));
    expect(screen.getAllByTestId('table-row')).toHaveLength(2);
  });
});
