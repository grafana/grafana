import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import arrayMutators from 'final-form-arrays';
import React from 'react';
import { Form } from 'react-final-form';

import { dbClustersStub } from '../../__mocks__/dbClustersStubs';

import { DBClusterAdvancedOptions } from './DBClusterAdvancedOptions';
import { AdvancedOptionsFields, DBClusterResources } from './DBClusterAdvancedOptions.types';

jest.mock('../../DBCluster.service');
jest.mock('../../PSMDB.service');
jest.mock('../../XtraDB.service');
jest.mock('app/percona/dbaas/components/Kubernetes/Kubernetes.service');

jest.mock('@percona/platform-core', () => {
  const originalModule = jest.requireActual('@percona/platform-core');
  return {
    ...originalModule,
    logger: {
      error: jest.fn(),
    },
  };
});

describe('DBClusterAdvancedOptions::', () => {
  it('renders correctly in create mode', async () => {
    await waitFor(() =>
      render(
        <Form
          onSubmit={jest.fn() as (values: Record<string, object>) => Promise<void>}
          mutators={{ ...arrayMutators }}
          render={({ form, handleSubmit, valid, pristine, ...props }) => (
            <DBClusterAdvancedOptions
              mode="create"
              showUnsafeConfigurationWarning={true}
              setShowUnsafeConfigurationWarning={jest.fn()}
              form={form}
              selectedCluster={dbClustersStub[0]}
              handleSubmit={handleSubmit}
              pristine={pristine}
              valid={valid}
              {...props}
            />
          )}
        />
      )
    );

    const advancedOptions = screen.getByTestId('dbCluster-advanced-settings');
    await waitFor(() => fireEvent.click(advancedOptions));

    expect(await screen.getByTestId('template-field-container')).toBeInTheDocument();
    expect(await screen.getByTestId('nodes-number-input')).toBeInTheDocument();
    expect(await screen.getByTestId('resources-field-container')).toBeInTheDocument();
    expect(await screen.getByTestId('memory-number-input')).toBeInTheDocument();
    expect(await screen.getByTestId('cpu-number-input')).toBeInTheDocument();
    expect(await screen.getByTestId('disk-number-input')).toBeInTheDocument();
    expect(await screen.getByTestId('configurations')).toBeInTheDocument();
  });

  it('renders correctly in edit mode', async () => {
    await waitFor(() =>
      render(
        <Form
          onSubmit={jest.fn() as (values: Record<string, object>) => Promise<void>}
          mutators={{ ...arrayMutators }}
          render={({ form, handleSubmit, valid, pristine, ...props }) => (
            <DBClusterAdvancedOptions
              mode="edit"
              showUnsafeConfigurationWarning={true}
              setShowUnsafeConfigurationWarning={jest.fn()}
              form={form}
              selectedCluster={dbClustersStub[0]}
              handleSubmit={handleSubmit}
              pristine={pristine}
              valid={valid}
              {...props}
            />
          )}
        />
      )
    );

    expect(await screen.getByTestId('template-field-container')).toBeInTheDocument();
    expect(await screen.getByTestId('nodes-number-input')).toBeInTheDocument();
    expect(await screen.getByTestId('resources-field-container')).toBeInTheDocument();
    expect(await screen.getByTestId('memory-number-input')).toBeInTheDocument();
    expect(await screen.getByTestId('cpu-number-input')).toBeInTheDocument();
    expect(await screen.getByTestId('disk-number-input')).toBeInTheDocument();
    expect(screen.getByTestId('dbcluster-resources-bar-memory')).toBeInTheDocument();
    expect(screen.getByTestId('dbcluster-resources-bar-cpu')).toBeInTheDocument();
    expect(await screen.getByTestId('configurations')).toBeInTheDocument();
  });

  it('renders correctly with initial values', async () => {
    await waitFor(() =>
      render(
        <Form
          onSubmit={jest.fn() as (values: Record<string, object>) => Promise<void>}
          initialValues={{ [AdvancedOptionsFields.nodes]: 3 }}
          mutators={{ ...arrayMutators }}
          render={({ form, handleSubmit, valid, pristine, ...props }) => (
            <DBClusterAdvancedOptions
              mode="create"
              showUnsafeConfigurationWarning={true}
              setShowUnsafeConfigurationWarning={jest.fn()}
              form={form}
              selectedCluster={dbClustersStub[0]}
              handleSubmit={handleSubmit}
              pristine={pristine}
              valid={valid}
              {...props}
            />
          )}
        />
      )
    );
    const advancedOptions = screen.getByTestId('dbCluster-advanced-settings');
    await waitFor(() => fireEvent.click(advancedOptions));

    const nodes = screen.getByTestId('nodes-number-input');
    expect(nodes.getAttribute('value')).toBe('3');
  });

  it('should disable memory, cpu and disk when resources are not custom', async () => {
    await waitFor(() =>
      render(
        <Form
          onSubmit={jest.fn() as (values: Record<string, object>) => Promise<void>}
          initialValues={{ [AdvancedOptionsFields.resources]: DBClusterResources.small }}
          mutators={{ ...arrayMutators }}
          render={({ form, handleSubmit, valid, pristine, ...props }) => (
            <DBClusterAdvancedOptions
              mode="create"
              showUnsafeConfigurationWarning={true}
              setShowUnsafeConfigurationWarning={jest.fn()}
              form={form}
              selectedCluster={dbClustersStub[0]}
              handleSubmit={handleSubmit}
              pristine={pristine}
              valid={valid}
              {...props}
            />
          )}
        />
      )
    );

    const advancedOptions = screen.getByTestId('dbCluster-advanced-settings');
    await waitFor(() => fireEvent.click(advancedOptions));

    const memory = screen.getByTestId('memory-number-input');
    const cpu = screen.getByTestId('cpu-number-input');
    const disk = screen.getByTestId('disk-number-input');

    expect(memory).toBeDisabled();
    expect(cpu).toBeDisabled();
    expect(disk).toBeDisabled();
  });

  it('should enable memory and cpu when resources is custom', async () => {
    await waitFor(() =>
      render(
        <Form
          onSubmit={jest.fn() as (values: Record<string, object>) => Promise<void>}
          initialValues={{
            [AdvancedOptionsFields.resources]: DBClusterResources.small,
          }}
          mutators={{ ...arrayMutators }}
          render={({ form, handleSubmit, valid, pristine, ...props }) => (
            <DBClusterAdvancedOptions
              mode="create"
              showUnsafeConfigurationWarning={true}
              setShowUnsafeConfigurationWarning={jest.fn()}
              form={form}
              selectedCluster={dbClustersStub[0]}
              handleSubmit={handleSubmit}
              pristine={pristine}
              valid={valid}
              {...props}
            />
          )}
        />
      )
    );

    const advancedOptions = screen.getByTestId('dbCluster-advanced-settings');
    await waitFor(() => fireEvent.click(advancedOptions));

    const resources = screen.getByTestId('resources-field-container').querySelector('input');
    if (resources) {
      await waitFor(() => fireEvent.change(resources, { target: { value: DBClusterResources.custom } }));
    }

    const memory = screen.getByTestId('memory-number-input');
    const cpu = screen.getByTestId('cpu-number-input');
    const disk = screen.getByTestId('disk-number-input');

    expect(memory).toBeDisabled();
    expect(cpu).toBeDisabled();
    expect(disk).toBeDisabled();
  });

  it('should not show the arrow button in edit mode ', async () => {
    await waitFor(() =>
      render(
        <Form
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
          onSubmit={jest.fn() as (values: Record<string, any>) => Promise<void>}
          mutators={{ ...arrayMutators }}
          render={({ form, handleSubmit, valid, pristine, ...props }) => (
            <DBClusterAdvancedOptions
              mode="edit"
              showUnsafeConfigurationWarning={true}
              setShowUnsafeConfigurationWarning={jest.fn()}
              form={form}
              selectedCluster={dbClustersStub[0]}
              handleSubmit={handleSubmit}
              pristine={pristine}
              valid={valid}
              {...props}
            />
          )}
        />
      )
    );

    expect(screen.queryByTestId('dbCluster-advanced-settings')).not.toBeInTheDocument();
  });
});
