import React from 'react';
import { KubernetesClusterActions } from './KubernetesClusterActions';
import { kubernetesStub } from '../__mocks__/kubernetesStubs';
import { render, screen, fireEvent } from '@testing-library/react';

describe('KubernetesClusterActions::', () => {
  it('renders correctly', async () => {
    render(
      <KubernetesClusterActions
        kubernetesCluster={kubernetesStub[0]}
        setSelectedCluster={jest.fn()}
        setDeleteModalVisible={jest.fn()}
        setViewConfigModalVisible={jest.fn()}
        setManageComponentsModalVisible={jest.fn()}
        getDBClusters={jest.fn()}
      />
    );

    expect(screen.getByTestId('dropdown-menu-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('dropdown-menu-container')).toBeInTheDocument();
  });

  it('Select delete actions', async () => {
    const setSelectedCluster = jest.fn();
    const setDeleteModalVisible = jest.fn();
    render(
      <KubernetesClusterActions
        kubernetesCluster={kubernetesStub[1]}
        setSelectedCluster={setSelectedCluster}
        setDeleteModalVisible={setDeleteModalVisible}
        setViewConfigModalVisible={jest.fn()}
        setManageComponentsModalVisible={jest.fn()}
        getDBClusters={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Unregister'));

    expect(setSelectedCluster).toHaveBeenCalled();
    expect(setDeleteModalVisible).toHaveBeenCalled();
  });

  it('Select view cluster config action', async () => {
    const setSelectedCluster = jest.fn();
    const setDeleteModalVisible = jest.fn();
    const setViewConfigModalVisible = jest.fn();

    render(
      <KubernetesClusterActions
        kubernetesCluster={kubernetesStub[1]}
        setSelectedCluster={setSelectedCluster}
        setDeleteModalVisible={setDeleteModalVisible}
        setViewConfigModalVisible={setViewConfigModalVisible}
        setManageComponentsModalVisible={jest.fn()}
        getDBClusters={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Show configuration'));

    expect(setSelectedCluster).toHaveBeenCalled();
    expect(setViewConfigModalVisible).toHaveBeenCalled();
  });
});
