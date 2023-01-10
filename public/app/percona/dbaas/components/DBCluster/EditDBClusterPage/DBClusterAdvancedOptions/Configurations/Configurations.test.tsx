import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { Form } from 'react-final-form';

import { Databases } from '../../../../../../shared/core';
import { Messages } from '../DBClusterAdvancedOptions.messages';

import Configurations from './Configurations';
jest.mock('app/percona/dbaas/components/Kubernetes/Kubernetes.service');

describe('DBClusterAdvancedOptions Configurations::', () => {
  it('renders items correctly', async () => {
    await waitFor(() =>
      render(
        <Form
          onSubmit={jest.fn()}
          render={() => <Configurations databaseType={Databases.haproxy} k8sClusterName={'testName'} />}
        />
      )
    );
    expect(screen.getByTestId('configurations').querySelector('legend')).toHaveTextContent(
      Messages.fieldSets.commonConfiguration
    );
    expect(screen.getByTestId('storageClass-field-label')).toHaveTextContent(Messages.labels.storageClass);
    expect(screen.getByTestId('storageClass-field-container').querySelector('input')).toBeTruthy();
    expect(screen.getByTestId('configuration-field-label')).toHaveTextContent(Messages.labels.commonConfiguration);
    expect(screen.getByTestId('configuration-textarea-input')).toBeInTheDocument();
  });

  it('shows labels correctly for pxc', async () => {
    await waitFor(() =>
      render(
        <Form
          onSubmit={jest.fn()}
          render={() => <Configurations databaseType={Databases.mysql} k8sClusterName={'testName'} />}
        />
      )
    );
    expect(screen.getByTestId('configurations').querySelector('legend')).toHaveTextContent(
      Messages.fieldSets.pxcConfiguration
    );
    expect(screen.getByTestId('configuration-field-label')).toHaveTextContent(Messages.labels.pxcConfiguration);
  });

  it('shows labels correctly for mongoDB', async () => {
    await waitFor(() =>
      render(
        <Form
          onSubmit={jest.fn()}
          render={() => <Configurations databaseType={Databases.mongodb} k8sClusterName={'testName'} />}
        />
      )
    );
    expect(screen.getByTestId('configurations').querySelector('legend')).toHaveTextContent(
      Messages.fieldSets.mongodbConfiguration
    );
    expect(screen.getByTestId('configuration-field-label')).toHaveTextContent(Messages.labels.mongodbConfiguration);
  });
});
