import { render, fireEvent, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';

import { locationService } from '@grafana/runtime';
import { configureStore } from 'app/store/configureStore';
import { StoreState } from 'app/types';

import { KubernetesClusterStatus } from '../../Kubernetes/KubernetesClusterStatus/KubernetesClusterStatus.types';
import { KubernetesOperatorStatus } from '../../Kubernetes/OperatorStatusItem/KubernetesOperatorStatus/KubernetesOperatorStatus.types';
import { kubernetesStub } from '../../Kubernetes/__mocks__/kubernetesStubs';

import { AddDBClusterModal } from './AddDBClusterModal';
import { updateDatabaseClusterNameInitialValue } from './AddDBClusterModal.utils';
import { onDBClusterAddedStub, setVisibleStub } from './__mocks__/addDBClusterModalStubs';

jest.mock('./AddDBClusterModal.utils', () => ({
  ...jest.requireActual('./AddDBClusterModal.utils'),
  updateDatabaseClusterNameInitialValue: jest.fn(),
}));

jest.mock('app/core/app_events');

describe('AddDBClusterModal::', () => {
  const openStep = (step: string) => {
    const stepNode = screen.getByTestId(`${step}`).querySelector('[data-testid="step-header"]');
    if (stepNode) {
      fireEvent.click(stepNode);
    }
  };

  const isStepActive = (step: string) => {
    const stepNode = screen.getByTestId(`${step}`).querySelector('[data-testid="step-content"]');
    return stepNode ? stepNode.getElementsByTagName('div')[0].className.split('-')?.includes('current') : false;
  };

  it('renders correctly', () => {
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
          <AddDBClusterModal
            kubernetes={kubernetesStub}
            isVisible
            setVisible={setVisibleStub}
            onSubmit={onDBClusterAddedStub}
            preSelectedKubernetesCluster={null}
          />
        </Router>
      </Provider>
    );

    expect(screen.findByRole('form')).toBeTruthy();
    expect(screen.getByTestId('name-text-input')).toBeTruthy();
    expect(screen.getByTestId('dbcluster-kubernetes-cluster-field')).toBeTruthy();
    expect(screen.getByTestId('dbcluster-database-type-field')).toBeTruthy();
    expect(screen.getByTestId('step-progress-submit-button')).toBeTruthy();
    expect(screen.getByTestId('dbcluster-basic-options-step')).toBeTruthy();
    expect(screen.getByTestId('dbcluster-advanced-options-step')).toBeTruthy();
    expect(screen.getByTestId('dbcluster-advanced-options-step')).toBeTruthy();
    expect(screen.findByTestId('add-cluster-monitoring-warning')).toBeTruthy();
  });

  it('should disable submit button when there is no values', () => {
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
          <AddDBClusterModal
            kubernetes={kubernetesStub}
            isVisible
            setVisible={setVisibleStub}
            onSubmit={onDBClusterAddedStub}
            preSelectedKubernetesCluster={null}
          />
        </Router>
      </Provider>
    );

    openStep('dbcluster-advanced-options-step');

    const button = screen.getByTestId('step-progress-submit-button');
    expect(button).toBeDisabled();
  });

  it('should change step correctly', () => {
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
          <AddDBClusterModal
            kubernetes={kubernetesStub}
            isVisible
            setVisible={setVisibleStub}
            onSubmit={onDBClusterAddedStub}
            preSelectedKubernetesCluster={null}
          />
        </Router>
      </Provider>
    );

    expect(isStepActive('dbcluster-basic-options-step')).toBeTruthy();
    openStep('dbcluster-advanced-options-step');
    expect(isStepActive('dbcluster-advanced-options-step')).toBeTruthy();
    expect(isStepActive('dbcluster-basic-options-step')).toBeFalsy();
  });

  it('form should have default values', () => {
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
          <AddDBClusterModal
            kubernetes={kubernetesStub}
            isVisible
            setVisible={setVisibleStub}
            onSubmit={onDBClusterAddedStub}
            preSelectedKubernetesCluster={null}
          />
        </Router>
      </Provider>
    );

    expect(updateDatabaseClusterNameInitialValue).toHaveBeenCalledWith(
      expect.objectContaining({
        databaseType: expect.objectContaining({ value: 'mongodb' }),
        kubernetesCluster: expect.objectContaining({
          value: 'Cluster 1',
        }),
        name: expect.stringContaining('mongodb-'),
      })
    );
  });

  it('form should have default values from preselectedCluster', () => {
    const preSelectedCluster = {
      kubernetesClusterName: 'testPreselectedCluster',
      operators: {
        psmdb: {
          availableVersion: '1.12.0',
          status: KubernetesOperatorStatus.ok,
          version: '1.11.0',
        },
        pxc: {
          availableVersion: undefined,
          status: KubernetesOperatorStatus.ok,
          version: '1.11.0',
        },
      },
      status: KubernetesClusterStatus.ok,
    };

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
          <AddDBClusterModal
            kubernetes={kubernetesStub}
            isVisible
            setVisible={setVisibleStub}
            onSubmit={onDBClusterAddedStub}
            preSelectedKubernetesCluster={preSelectedCluster}
          />
        </Router>
      </Provider>
    );

    expect(updateDatabaseClusterNameInitialValue).toHaveBeenCalledWith(
      expect.objectContaining({
        databaseType: expect.objectContaining({ value: 'mongodb' }),
        kubernetesCluster: expect.objectContaining({
          value: 'testPreselectedCluster',
        }),
        name: expect.stringContaining('mongodb-'),
      })
    );
  });
});
