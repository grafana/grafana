import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { Form, FormRenderProps } from 'react-final-form';

import { Databases } from 'app/percona/shared/core';

import { dbClustersStub } from '../../__mocks__/dbClustersStubs';
import { EditDBClusterFields } from '../EditDBClusterModal.types';

import { DBClusterAdvancedOptions } from './DBClusterAdvancedOptions';
import { DBClusterResources } from './DBClusterAdvancedOptions.types';

jest.mock('../../DBCluster.service');
jest.mock('../../PSMDB.service');
jest.mock('../../XtraDB.service');

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
  it('renders correctly', async () => {
    act(() => {
      render(
        <Form
          onSubmit={jest.fn()}
          render={(renderProps) => (
            <DBClusterAdvancedOptions
              renderProps={renderProps}
              selectedCluster={dbClustersStub[0]}
              setShowUnsafeConfigurationWarning={jest.fn()}
            />
          )}
        />
      );
    });

    const radioState = await screen.findByTestId('topology-radio-state');

    expect(radioState).toBeInTheDocument();
    expect(await screen.queryByTestId('nodes-number-input')).toBeInTheDocument();
    expect(await screen.getAllByTestId('resources-radio-button').length).toBeGreaterThan(0);
    expect(await screen.queryByTestId('memory-number-input')).toBeInTheDocument();
    expect(await screen.queryByTestId('cpu-number-input')).toBeInTheDocument();
    expect(await screen.queryByTestId('disk-number-input')).toBeInTheDocument();
  });

  it('should disable memory, cpu and disk when resources are not custom', async () => {
    act(() => {
      render(
        <Form
          initialValues={{
            [EditDBClusterFields.resources]: DBClusterResources.small,
          }}
          onSubmit={jest.fn()}
          render={(renderProps: FormRenderProps) => (
            <DBClusterAdvancedOptions
              renderProps={renderProps}
              selectedCluster={dbClustersStub[0]}
              setShowUnsafeConfigurationWarning={jest.fn()}
            />
          )}
        />
      );
    });

    const memory = await screen.findByTestId('memory-number-input');
    const cpu = screen.getByTestId('cpu-number-input');
    const disk = screen.getByTestId('disk-number-input');

    expect(memory).toBeDisabled();
    expect(cpu).toBeDisabled();
    expect(disk).toBeDisabled();
  });

  it('should enable memory and cpu when resources are custom, disk should be disabled', async () => {
    act(() => {
      render(
        <Form
          initialValues={{
            [EditDBClusterFields.resources]: DBClusterResources.small,
          }}
          onSubmit={jest.fn()}
          render={(renderProps: FormRenderProps) => (
            <DBClusterAdvancedOptions
              renderProps={renderProps}
              selectedCluster={dbClustersStub[0]}
              setShowUnsafeConfigurationWarning={jest.fn()}
            />
          )}
        />
      );
    });

    fireEvent.change(screen.getByTestId('resources-radio-state'), { target: { value: DBClusterResources.custom } });

    const memory = await screen.findByTestId('memory-number-input');
    const cpu = await screen.getByTestId('cpu-number-input');
    const disk = await screen.getByTestId('disk-number-input');

    expect(memory).not.toBeDisabled();
    expect(cpu).not.toBeDisabled();
    expect(disk).toBeDisabled();
  });

  it('should disable button when invalid', async () => {
    act(() => {
      render(
        <Form
          onSubmit={jest.fn()}
          render={(renderProps) => (
            <DBClusterAdvancedOptions
              renderProps={renderProps}
              selectedCluster={dbClustersStub[0]}
              setShowUnsafeConfigurationWarning={jest.fn()}
            />
          )}
        />
      );
    });
    const button = await screen.findByTestId('dbcluster-update-cluster-button');

    expect(button).toBeDisabled();
  });

  it('should enable button when valid', async () => {
    act(() => {
      render(
        <Form
          onSubmit={jest.fn()}
          render={(renderProps) => (
            <DBClusterAdvancedOptions
              renderProps={{ ...renderProps, valid: true, pristine: false }}
              selectedCluster={dbClustersStub[0]}
              setShowUnsafeConfigurationWarning={jest.fn()}
            />
          )}
        />
      );
    });
    const button = await screen.findByTestId('dbcluster-update-cluster-button');

    expect(button).not.toBeDisabled();
  });

  it('should enable single node topology when database is MongoDB', async () => {
    act(() => {
      render(
        <Form
          initialValues={{
            [EditDBClusterFields.databaseType]: {
              value: Databases.mongodb,
              key: Databases.mongodb,
            },
          }}
          onSubmit={jest.fn()}
          render={(renderProps: FormRenderProps) => (
            <DBClusterAdvancedOptions
              renderProps={renderProps}
              selectedCluster={dbClustersStub[2]}
              setShowUnsafeConfigurationWarning={jest.fn()}
            />
          )}
        />
      );
    });
    const topology = await screen.findAllByTestId('topology-radio-button');

    expect(topology[1]).not.toBeDisabled();
  });

  it('should enable single node topology when database is MySQL', async () => {
    act(() => {
      render(
        <Form
          initialValues={{
            [EditDBClusterFields.databaseType]: {
              value: Databases.mysql,
              key: Databases.mysql,
            },
          }}
          onSubmit={jest.fn()}
          render={(renderProps: FormRenderProps) => (
            <DBClusterAdvancedOptions
              renderProps={renderProps}
              selectedCluster={dbClustersStub[0]}
              setShowUnsafeConfigurationWarning={jest.fn()}
            />
          )}
        />
      );
    });
    const topology = await screen.findAllByTestId('topology-radio-button');

    expect(topology[1]).not.toBeDisabled();
  });
});
