import { screen, render, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { Form } from 'react-final-form';
import { Provider } from 'react-redux';

import { configureStore } from '../../../../../../store/configureStore';
import { StoreState } from '../../../../../../types';

import { Restore } from './Restore';

jest.mock('app/percona/dbaas/components/Kubernetes/Kubernetes.service');
jest.mock('app/percona/backup/components/StorageLocations/StorageLocations.service');
jest.mock('app/percona/dbaas/components/DBCluster/EditDBClusterPage/DBaaSBackups/DBaaSBackups.service');

const store = configureStore({
  percona: {
    user: { isAuthorized: true },
    kubernetes: {
      loading: false,
    },
  },
} as StoreState);

describe('DBaaS DBCluster creation Restore section ::', () => {
  it('renders items correctly, shows fields on switch on', async () => {
    await waitFor(() =>
      render(
        <Provider store={store}>
          <Form onSubmit={jest.fn()} render={({ form }) => <Restore form={form} />} />
        </Provider>
      )
    );
    expect(screen.getByTestId('toggle-scheduled-restore')).toBeInTheDocument();
    const checkbox = screen.getByTestId('toggle-scheduled-restore');
    fireEvent.click(checkbox);
    expect(screen.getByTestId('locations-select-wrapper')).toBeInTheDocument();
  });
  it('shows backup artifacts field when location field is not empty', async () => {
    await waitFor(() =>
      render(
        <Provider store={store}>
          <Form
            onSubmit={jest.fn()}
            initialValues={{
              restoreFrom: {
                label: 'location1',
                value: 'location1',
              },
            }}
            render={({ form }) => {
              return <Restore form={form} />;
            }}
          />
        </Provider>
      )
    );

    expect(screen.getByTestId('toggle-scheduled-restore')).toBeInTheDocument();
    const checkbox = screen.getByTestId('toggle-scheduled-restore');
    await waitFor(() => fireEvent.click(checkbox));
    expect(screen.getByTestId('backupArtifact-field-container')).toBeInTheDocument();
  });
  it('shows secrets field if kubernetesCluster name exists in form', async () => {
    await waitFor(() =>
      render(
        <Provider store={store}>
          <Form
            onSubmit={jest.fn()}
            initialValues={{
              kubernetesCluster: {
                label: 'cluster 1',
                value: 'cluster 1',
              },
            }}
            render={({ form }) => {
              return <Restore form={form} />;
            }}
          />
        </Provider>
      )
    );

    expect(screen.getByTestId('toggle-scheduled-restore')).toBeInTheDocument();
    const checkbox = screen.getByTestId('toggle-scheduled-restore');
    await waitFor(() => fireEvent.click(checkbox));
    expect(screen.getByTestId('secretsName-field-container')).toBeInTheDocument();
  });
});
