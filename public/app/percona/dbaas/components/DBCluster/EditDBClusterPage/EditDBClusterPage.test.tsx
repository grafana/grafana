import { render, fireEvent, screen } from '@testing-library/react';
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

jest.mock('./EditDBClusterPage.utils', () => ({
  ...jest.requireActual('./EditDBClusterPage.utils'),
  updateDatabaseClusterNameInitialValue: jest.fn(),
}));

jest.mock('app/core/app_events');

describe('EditDBClusterPage::', () => {
  // TODO db-cluster-submit-button message should have different values depends on mode of page
  // TODO the header of page should have different values depends on mode of page

  it('renders correctly', () => {
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
          <EditDBClusterPage kubernetes={kubernetesStub} mode="create" />
        </Router>
      </Provider>
    );

    expect(screen.findByRole('form')).toBeTruthy();
    expect(screen.getByTestId('name-text-input')).toBeTruthy();
    expect(screen.getByTestId('dbcluster-kubernetes-cluster-field')).toBeTruthy();
    expect(screen.getByTestId('dbcluster-database-type-field')).toBeTruthy();
    expect(screen.getByTestId('dbcluster-basic-options-step')).toBeTruthy();
    expect(screen.getByTestId('list-dbCluster-advanced-settings')).toBeTruthy();
    expect(screen.findByTestId('add-cluster-monitoring-warning')).toBeTruthy();
    expect(screen.getByTestId('db-cluster-cancel-button')).toBeInTheDocument();
    expect(screen.getByTestId('db-cluster-submit-button')).toBeInTheDocument();
  });

  it('should disable submit button when there is no values', async () => {
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
          <EditDBClusterPage kubernetes={kubernetesStub} mode="create" />
        </Router>
      </Provider>
    );

    fireEvent.click(screen.getByTestId('list-dbCluster-advanced-settings'));

    const button = screen.getByTestId('db-cluster-submit-button');
    expect(button).toBeDisabled();
  });

  // TODO should be return in https://jira.percona.com/browse/PMM-11134
  xit('form should have default values', () => {
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
          <EditDBClusterPage kubernetes={kubernetesStub} mode="create" />
        </Router>
      </Provider>
    );
  });

  // TODO should be return in https://jira.percona.com/browse/PMM-11134
  xit('form should have default values from preselectedCluster', () => {
    // const preSelectedCluster = {
    //   kubernetesClusterName: 'testPreselectedCluster',
    //   operators: {
    //     psmdb: {
    //       availableVersion: '1.12.0',
    //       status: KubernetesOperatorStatus.ok,
    //       version: '1.11.0',
    //     },
    //     pxc: {
    //       availableVersion: undefined,
    //       status: KubernetesOperatorStatus.ok,
    //       version: '1.11.0',
    //     },
    //   },
    //   status: KubernetesClusterStatus.ok,
    // };

    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: { loading: false, result: { isConnectedToPortal: true, alertingEnabled: true } },
          },
        } as StoreState)}
      >
        <Router history={locationService.getHistory()}>
          <EditDBClusterPage kubernetes={kubernetesStub} mode="create" />
        </Router>
      </Provider>
    );

    // expect(updateDatabaseClusterNameInitialValue).toHaveBeenCalledWith(
    //   expect.objectContaining({
    //     databaseType: expect.objectContaining({ value: 'mongodb' }),
    //     kubernetesCluster: expect.objectContaining({
    //       value: 'testPreselectedCluster',
    //     }),
    //     name: expect.stringContaining('mongodb-'),
    //   })
    // );
  });
});
