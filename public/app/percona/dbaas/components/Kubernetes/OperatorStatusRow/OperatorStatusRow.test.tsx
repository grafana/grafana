import { render, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';

import { configureStore } from '../../../../../store/configureStore';
import { StoreState } from '../../../../../types';
import { KubernetesClusterStatus } from '../KubernetesClusterStatus/KubernetesClusterStatus.types';
import { KubernetesOperatorStatus } from '../OperatorStatusItem/KubernetesOperatorStatus/KubernetesOperatorStatus.types';

import { OperatorStatusRow } from './OperatorStatusRow';

describe('OperatorStatusRow::', () => {
  it('createDBCluster button should be disabled when kubernetesClusterStatus is invalid', async () => {
    const element = {
      kubernetesClusterName: 'cluster1',
      status: KubernetesClusterStatus.invalid,
      operators: {
        psmdb: { status: KubernetesOperatorStatus.ok, version: '1', availableVersion: '1' },
        pxc: { status: KubernetesOperatorStatus.ok, version: '1', availableVersion: '1' },
      },
    };
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: { loading: false, result: { isConnectedToPortal: true, dbaasEnabled: true } },
          },
        } as StoreState)}
      >
        <OperatorStatusRow
          element={element}
          setSelectedCluster={jest.fn}
          setOperatorToUpdate={jest.fn}
          setUpdateOperatorModalVisible={jest.fn}
        />
      </Provider>
    );

    expect(screen.getByTestId('cluster1-add-cluster-button')).toBeDisabled();
  });

  it('createDBCluster button should be disabled when kubernetesClusterStatus is unavailable', async () => {
    const element = {
      kubernetesClusterName: 'cluster1',
      status: KubernetesClusterStatus.unavailable,
      operators: {
        psmdb: { status: KubernetesOperatorStatus.ok, version: '1', availableVersion: '1' },
        pxc: { status: KubernetesOperatorStatus.ok, version: '1', availableVersion: '1' },
      },
    };
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: { loading: false, result: { isConnectedToPortal: true, dbaasEnabled: true } },
          },
        } as StoreState)}
      >
        <OperatorStatusRow
          element={element}
          setSelectedCluster={jest.fn}
          setOperatorToUpdate={jest.fn}
          setUpdateOperatorModalVisible={jest.fn}
        />
      </Provider>
    );
    expect(screen.getByTestId('cluster1-add-cluster-button')).toBeDisabled();
  });

  it('createDBCluster button should be disabled when both operators are not ok', async () => {
    const element = {
      kubernetesClusterName: 'cluster1',
      status: KubernetesClusterStatus.ok,
      operators: {
        psmdb: { status: KubernetesOperatorStatus.invalid, version: '1', availableVersion: '1' },
        pxc: { status: KubernetesOperatorStatus.unsupported, version: '1', availableVersion: '1' },
      },
    };
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: { loading: false, result: { isConnectedToPortal: true, dbaasEnabled: true } },
          },
        } as StoreState)}
      >
        <OperatorStatusRow
          element={element}
          setSelectedCluster={jest.fn}
          setOperatorToUpdate={jest.fn}
          setUpdateOperatorModalVisible={jest.fn}
        />
      </Provider>
    );
    expect(screen.getByTestId('cluster1-add-cluster-button')).toBeDisabled();
  });

  it('createDBCluster button should be disabled when both operators are not ok', async () => {
    const element = {
      kubernetesClusterName: 'cluster1',
      status: KubernetesClusterStatus.ok,
      operators: {
        psmdb: { status: KubernetesOperatorStatus.unavailable, version: '1', availableVersion: '1' },
        pxc: { status: KubernetesOperatorStatus.invalid, version: '1', availableVersion: '1' },
      },
    };
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: { loading: false, result: { isConnectedToPortal: true, dbaasEnabled: true } },
          },
        } as StoreState)}
      >
        <OperatorStatusRow
          element={element}
          setSelectedCluster={jest.fn}
          setOperatorToUpdate={jest.fn}
          setUpdateOperatorModalVisible={jest.fn}
        />
      </Provider>
    );
    expect(screen.getByTestId('cluster1-add-cluster-button')).toBeDisabled();
  });

  it('createDBCluster button should be enabled when clusterStatus and operatorStatus have ok status', async () => {
    const element = {
      kubernetesClusterName: 'cluster1',
      status: KubernetesClusterStatus.ok,
      operators: {
        psmdb: { status: KubernetesOperatorStatus.ok, version: '1', availableVersion: '1' },
        pxc: { status: KubernetesOperatorStatus.ok, version: '1', availableVersion: '1' },
      },
    };
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: { loading: false, result: { isConnectedToPortal: true, dbaasEnabled: true } },
          },
        } as StoreState)}
      >
        <OperatorStatusRow
          element={element}
          setSelectedCluster={jest.fn}
          setOperatorToUpdate={jest.fn}
          setUpdateOperatorModalVisible={jest.fn}
        />
      </Provider>
    );
    expect(screen.getByTestId('cluster1-add-cluster-button')).not.toBeDisabled();
  });
});
