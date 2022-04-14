import React from 'react';
import { UpdateOperatorModal } from './UpdateOperatorModal';
import { KubernetesOperatorStatus } from '../KubernetesOperatorStatus.types';
import { ComponentToUpdate } from '../../../Kubernetes.types';
import { render, screen, fireEvent } from '@testing-library/react';

jest.mock('../../../Kubernetes.service');

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
      <UpdateOperatorModal
        kubernetesClusterName="test_cluster"
        isVisible
        selectedOperator={operator}
        setVisible={jest.fn()}
        setLoading={jest.fn()}
        setSelectedCluster={jest.fn()}
        setOperatorToUpdate={jest.fn()}
        onOperatorUpdated={jest.fn()}
      />
    );
    const message = 'PXC 1.7.0 to version 1.8.0 in test_cluster';

    expect(screen.getByTestId('update-operator-message')).toHaveTextContent(message);
  });

  it('should call onOperatorUpdated after installation', async () => {
    const onOperatorUpdated = jest.fn();
    render(
      <UpdateOperatorModal
        kubernetesClusterName="test_cluster"
        isVisible
        selectedOperator={operator}
        setVisible={jest.fn()}
        setLoading={jest.fn()}
        setSelectedCluster={jest.fn()}
        setOperatorToUpdate={jest.fn()}
        onOperatorUpdated={onOperatorUpdated}
      />
    );

    jest.useFakeTimers();
    const btn = screen.getByTestId('confirm-update-operator-button');
    fireEvent.click(btn);
    await jest.runOnlyPendingTimers();

    expect(onOperatorUpdated).toHaveBeenCalledTimes(1);
  });

  it('should clear selected clsuter and operator on close', async () => {
    const setVisible = jest.fn();
    const setSelectedCluster = jest.fn();
    const setOperatorToUpdate = jest.fn();
    render(
      <UpdateOperatorModal
        kubernetesClusterName="test_cluster"
        isVisible
        selectedOperator={operator}
        setVisible={setVisible}
        setLoading={jest.fn()}
        setSelectedCluster={setSelectedCluster}
        setOperatorToUpdate={setOperatorToUpdate}
        onOperatorUpdated={jest.fn()}
      />
    );

    jest.useFakeTimers();
    const btn = screen.getByTestId('confirm-update-operator-button');
    fireEvent.click(btn);
    await jest.runOnlyPendingTimers();

    expect(setVisible).toHaveBeenCalledWith(false);
    expect(setSelectedCluster).toHaveBeenCalledWith(null);
    expect(setOperatorToUpdate).toHaveBeenCalledWith(null);
  });
});
