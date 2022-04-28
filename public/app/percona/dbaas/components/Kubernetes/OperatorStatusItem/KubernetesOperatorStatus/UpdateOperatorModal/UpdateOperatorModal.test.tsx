import React from 'react';
import { Provider } from 'react-redux';
import { StoreState } from 'app/types';
import { configureStore } from 'app/store/configureStore';
import { render, screen, fireEvent } from '@testing-library/react';
import { UpdateOperatorModal } from './UpdateOperatorModal';
import { KubernetesOperatorStatus } from '../KubernetesOperatorStatus.types';
import { ComponentToUpdate } from '../../../Kubernetes.types';

jest.mock('app/percona/dbaas/components/Kubernetes/Kubernetes.service');

describe('UpdateOperatorModal::', () => {
  const operator = {
    status: KubernetesOperatorStatus.ok,
    version: '1.7.0',
    availableVersion: '1.8.0',
    operatorType: ComponentToUpdate.pxc,
    operatorTypeLabel: 'PXC',
  };

  it('should render message with new operator version', () => {
    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: { loading: false, result: { isConnectedToPortal: true, dbaasEnabled: true } },
          },
        } as StoreState)}
      >
        <UpdateOperatorModal
          kubernetesClusterName="test_cluster"
          isVisible
          selectedOperator={operator}
          setVisible={jest.fn()}
          setSelectedCluster={jest.fn()}
          setOperatorToUpdate={jest.fn()}
        />
      </Provider>
    );
    const message = 'PXC 1.7.0 to version 1.8.0 in test_cluster';

    expect(screen.getByTestId('update-operator-message')).toHaveTextContent(message);
  });

  it('should clear selected clsuter and operator on close', async () => {
    const setVisible = jest.fn();
    const setSelectedCluster = jest.fn();
    const setOperatorToUpdate = jest.fn();

    render(
      <Provider
        store={configureStore({
          percona: {
            user: { isAuthorized: true },
            settings: { loading: false, result: { isConnectedToPortal: true, dbaasEnabled: true } },
          },
        } as StoreState)}
      >
        <UpdateOperatorModal
          kubernetesClusterName="test_cluster"
          isVisible
          selectedOperator={operator}
          setVisible={setVisible}
          setSelectedCluster={setSelectedCluster}
          setOperatorToUpdate={setOperatorToUpdate}
        />
      </Provider>
    );

    fireEvent.click(screen.getByTestId('confirm-update-operator-button'));

    expect(setVisible).toHaveBeenCalledWith(false);
    expect(setSelectedCluster).toHaveBeenCalledWith(null);
    expect(setOperatorToUpdate).toHaveBeenCalledWith(null);
  });
});
