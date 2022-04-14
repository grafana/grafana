import React from 'react';
import { KubernetesClusterActions } from './KubernetesClusterActions';
import { kubernetesStub } from '../__mocks__/kubernetesStubs';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

describe('KubernetesClusterActions::', () => {
  it('renders correctly', async () => {
    await waitFor(() =>
      render(
        <KubernetesClusterActions
          kubernetesCluster={kubernetesStub[0]}
          setSelectedCluster={jest.fn()}
          setDeleteModalVisible={jest.fn()}
          setViewConfigModalVisible={jest.fn()}
          setManageComponentsModalVisible={jest.fn()}
          getDBClusters={jest.fn()}
        />
      )
    );

    expect(screen.getByTestId('dropdown-menu-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('dropdown-menu-container')).toBeInTheDocument();
  });

  it('Select delete actions', async () => {
    const setSelectedCluster = jest.fn();
    const setDeleteModalVisible = jest.fn();
    await waitFor(() =>
      render(
        <KubernetesClusterActions
          kubernetesCluster={kubernetesStub[1]}
          setSelectedCluster={setSelectedCluster}
          setDeleteModalVisible={setDeleteModalVisible}
          setViewConfigModalVisible={jest.fn()}
          setManageComponentsModalVisible={jest.fn()}
          getDBClusters={jest.fn()}
        />
      )
    );

    const button = screen.getByRole('button');
    await waitFor(() => fireEvent.click(button));

    const action = screen.getByTestId('dropdown-menu-menu').querySelectorAll('span')[0];
    await waitFor(() => fireEvent.click(action));

    expect(setSelectedCluster).toHaveBeenCalled();
    expect(setDeleteModalVisible).toHaveBeenCalled();
  });

  it('Select view cluster config action', async () => {
    const setSelectedCluster = jest.fn();
    const setDeleteModalVisible = jest.fn();
    const setViewConfigModalVisible = jest.fn();
    await waitFor(() =>
      render(
        <KubernetesClusterActions
          kubernetesCluster={kubernetesStub[1]}
          setSelectedCluster={setSelectedCluster}
          setDeleteModalVisible={setDeleteModalVisible}
          setViewConfigModalVisible={setViewConfigModalVisible}
          setManageComponentsModalVisible={jest.fn()}
          getDBClusters={jest.fn()}
        />
      )
    );

    const button = screen.getByRole('button');
    await waitFor(() => fireEvent.click(button));

    const action = screen.getByTestId('dropdown-menu-menu').querySelectorAll('span')[1];
    await waitFor(() => fireEvent.click(action));

    expect(setSelectedCluster).toHaveBeenCalled();
    expect(setViewConfigModalVisible).toHaveBeenCalled();
  });
});
