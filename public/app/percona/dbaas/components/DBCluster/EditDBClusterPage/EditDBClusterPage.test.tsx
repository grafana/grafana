import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';

import { locationService } from '@grafana/runtime/src';
import { configureStore } from 'app/store/configureStore';
import { StoreState } from 'app/types';

import { KubernetesClusterStatus } from '../../Kubernetes/KubernetesClusterStatus/KubernetesClusterStatus.types';
import { KubernetesOperatorStatus } from '../../Kubernetes/OperatorStatusItem/KubernetesOperatorStatus/KubernetesOperatorStatus.types';
import { kubernetesStub } from '../../Kubernetes/__mocks__/kubernetesStubs';

import { EditDBClusterPage } from './EditDBClusterPage';
import { DB_CLUSTER_CREATION_URL, DB_CLUSTER_EDIT_URL } from './EditDBClusterPage.constants';

jest.mock('app/core/app_events');

describe('EditDBClusterPage::', () => {
  it('renders correctly for create mode', () => {
    locationService.push(DB_CLUSTER_CREATION_URL);

    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: {
              loading: false,
              result: { isConnectedToPortal: true, alertingEnabled: true, dbaasEnabled: true },
            },
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
          <EditDBClusterPage kubernetes={kubernetesStub} />
        </Router>
      </Provider>
    );

    expect(screen.findByRole('form')).toBeTruthy();

    expect(screen.findByTestId('add-cluster-monitoring-warning')).toBeTruthy();

    expect(screen.getByTestId('dbcluster-basic-options-step')).toBeTruthy();
    expect(screen.getByTestId('dbCluster-advanced-settings')).toBeTruthy();
    expect(screen.queryByTestId('nodes-field-container')).not.toBeInTheDocument();

    expect(screen.getByTestId('db-cluster-cancel-button')).toBeInTheDocument();
    expect(screen.getByTestId('db-cluster-submit-button')).toBeInTheDocument();
    expect(screen.getByTestId('db-cluster-submit-button')).toHaveTextContent('Create');
    expect(screen.getByTestId('network-and-security')).toBeInTheDocument();
    expect(screen.getByText('Create DB Cluster')).toBeInTheDocument();
  });

  it('renders correctly for edit mode', () => {
    locationService.push(DB_CLUSTER_EDIT_URL);

    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: {
              loading: false,
              result: { isConnectedToPortal: true, alertingEnabled: true, dbaasEnabled: true },
            },
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
          <EditDBClusterPage kubernetes={kubernetesStub} />
        </Router>
      </Provider>
    );

    expect(screen.queryByTestId('dbcluster-basic-options-step')).not.toBeInTheDocument();
    expect(screen.getByTestId('nodes-field-container')).toBeInTheDocument();

    expect(screen.getByTestId('db-cluster-cancel-button')).toBeInTheDocument();
    expect(screen.getByTestId('db-cluster-submit-button')).toBeInTheDocument();
    expect(screen.getByTestId('db-cluster-submit-button')).toHaveTextContent('Edit');
    expect(screen.getByTestId('network-and-security')).toBeInTheDocument();
    expect(screen.getByText('Edit DB Cluster')).toBeInTheDocument();
  });

  it('should disable submit button when there is no values', async () => {
    await waitFor(() =>
      render(
        <Provider
          store={configureStore({
            percona: {
              user: { isAuthorized: true },
              settings: {
                loading: false,
                result: { isConnectedToPortal: true, alertingEnabled: true, dbaasEnabled: true },
              },
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
            <EditDBClusterPage kubernetes={kubernetesStub} />
          </Router>
        </Provider>
      )
    );

    const button = screen.getByTestId('db-cluster-submit-button');
    expect(button).toBeDisabled();
  });

  it('should show notification if DBaaS is disabled', async () => {
    await waitFor(() =>
      render(
        <Provider
          store={configureStore({
            percona: {
              user: { isAuthorized: true },
              settings: {
                loading: false,
                result: {},
              },
            },
          } as StoreState)}
        >
          <Router history={locationService.getHistory()}>
            <EditDBClusterPage kubernetes={[]} />
          </Router>
        </Provider>
      )
    );

    expect(screen.getByTestId('empty-block')).toBeInTheDocument();
  });
});
