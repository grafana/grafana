import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { Form, FormRenderProps } from 'react-final-form';

import { Databases } from 'app/percona/shared/core';

import { AddDBClusterFields } from '../EditDBClusterPage.types';

import { DBClusterAdvancedOptions } from './DBClusterAdvancedOptions';
import { DBClusterResources, DBClusterTopology } from './DBClusterAdvancedOptions.types';

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
            <DBClusterAdvancedOptions setShowUnsafeConfigurationWarning={jest.fn()} {...renderProps} />
          )}
        />
      );
    });

    const radioState = await screen.findByTestId('topology-radio-state');

    expect(radioState).toBeInTheDocument();

    expect(screen.getByTestId('nodes-number-input')).toBeInTheDocument();
    expect(screen.getAllByTestId('resources-radio-button').length).toBeGreaterThan(0);
    expect(screen.getByTestId('memory-number-input')).toBeInTheDocument();
    expect(screen.getByTestId('cpu-number-input')).toBeInTheDocument();
    expect(screen.getByTestId('disk-number-input')).toBeInTheDocument();
    expect(screen.getByTestId('dbcluster-resources-bar-memory')).toBeInTheDocument();
    expect(screen.getByTestId('dbcluster-resources-bar-cpu')).toBeInTheDocument();
    expect(screen.getByTestId('disk-number-input')).toBeInTheDocument();
  });

  it('renders correctly with initial values', async () => {
    act(() => {
      render(
        <Form
          initialValues={{
            [AddDBClusterFields.topology]: DBClusterTopology.cluster,
            [AddDBClusterFields.nodes]: 3,
          }}
          onSubmit={jest.fn()}
          render={(renderProps: FormRenderProps) => (
            <DBClusterAdvancedOptions setShowUnsafeConfigurationWarning={jest.fn()} {...renderProps} />
          )}
        />
      );
    });

    const nodes = await screen.findByTestId('nodes-number-input');
    const topology = screen.getByTestId('topology-radio-state');

    expect(nodes.getAttribute('value')).toBe('3');
    expect(topology.getAttribute('value')).toEqual(DBClusterTopology.cluster);
  });

  it('should set nodes to 1 when topology is single', async () => {
    act(() => {
      render(
        <Form
          onSubmit={jest.fn()}
          render={(renderProps) => (
            <DBClusterAdvancedOptions setShowUnsafeConfigurationWarning={jest.fn()} {...renderProps} />
          )}
        />
      );
    });

    const topology = screen.getByTestId('topology-radio-state');

    fireEvent.change(topology, { target: { value: DBClusterTopology.single } });

    expect(screen.getByTestId('single-number-input')).toBeInTheDocument();
  });

  it('should disable memory, cpu and disk when resources are not custom', async () => {
    act(() => {
      render(
        <Form
          initialValues={{
            [AddDBClusterFields.resources]: DBClusterResources.small,
          }}
          onSubmit={jest.fn()}
          render={(renderProps: FormRenderProps) => (
            <DBClusterAdvancedOptions setShowUnsafeConfigurationWarning={jest.fn()} {...renderProps} />
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

  it('should enable memory and cpu when resources is custom', async () => {
    act(() => {
      render(
        <Form
          initialValues={{
            [AddDBClusterFields.resources]: DBClusterResources.small,
          }}
          onSubmit={jest.fn()}
          render={(renderProps: FormRenderProps) => (
            <DBClusterAdvancedOptions setShowUnsafeConfigurationWarning={jest.fn()} {...renderProps} />
          )}
        />
      );
    });

    const resources = await screen.findByTestId('resources-radio-state');
    fireEvent.change(resources, { target: { value: DBClusterResources.custom } });

    const memory = screen.getByTestId('memory-number-input');
    const cpu = screen.getByTestId('cpu-number-input');
    const disk = screen.getByTestId('disk-number-input');

    expect(memory).not.toBeDisabled();
    expect(cpu).not.toBeDisabled();
    expect(disk).not.toBeDisabled();
  });

  it('should enable single node topology when database is MongoDB', async () => {
    act(() => {
      render(
        <Form
          initialValues={{
            [AddDBClusterFields.databaseType]: {
              value: Databases.mongodb,
              key: Databases.mongodb,
            },
          }}
          onSubmit={jest.fn()}
          render={(renderProps: FormRenderProps) => (
            <DBClusterAdvancedOptions setShowUnsafeConfigurationWarning={jest.fn()} {...renderProps} />
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
            [AddDBClusterFields.databaseType]: {
              value: Databases.mysql,
              key: Databases.mysql,
            },
          }}
          onSubmit={jest.fn()}
          render={(renderProps: FormRenderProps) => (
            <DBClusterAdvancedOptions setShowUnsafeConfigurationWarning={jest.fn()} {...renderProps} />
          )}
        />
      );
    });
    const topology = await screen.findAllByTestId('topology-radio-button');

    expect(topology[1]).not.toBeDisabled();
  });
});
