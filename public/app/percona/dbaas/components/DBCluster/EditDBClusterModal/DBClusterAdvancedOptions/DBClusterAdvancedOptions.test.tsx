import React from 'react';
import { Form, FormRenderProps } from 'react-final-form';
import { Databases } from 'app/percona/shared/core';
import { getMount } from 'app/percona/shared/helpers/testUtils';
import { DBClusterAdvancedOptions } from './DBClusterAdvancedOptions';
import { EditDBClusterFields } from '../EditDBClusterModal.types';
import { DBClusterResources } from './DBClusterAdvancedOptions.types';
import { dbClustersStub } from '../../__mocks__/dbClustersStubs';

jest.mock('../../DBCluster.service');
jest.mock('../../PSMDB.service');
jest.mock('../../XtraDB.service');

xdescribe('DBClusterAdvancedOptions::', () => {
  it('renders correctly', async () => {
    const root = await getMount(
      <Form
        onSubmit={jest.fn()}
        render={(renderProps) => (
          <DBClusterAdvancedOptions renderProps={renderProps} selectedCluster={dbClustersStub[0]} />
        )}
      />
    );

    expect(root.find('[data-qa="topology-radio-state"]')).toBeTruthy();
    expect(root.find('[data-qa="nodes-number-input"]')).toBeTruthy();
    expect(root.find('[data-qa="resources-radio-button"]')).toBeTruthy();
    expect(root.find('[data-qa="memory-number-input"]')).toBeTruthy();
    expect(root.find('[data-qa="cpu-number-input"]')).toBeTruthy();
    expect(root.find('[data-qa="disk-number-input"]')).toBeTruthy();
    expect(root.find('[data-qa="step-progress-submit-button"]')).toBeTruthy();
  });

  it('should disable memory, cpu and disk when resources are not custom', async () => {
    const root = await getMount(
      <Form
        initialValues={{
          [EditDBClusterFields.resources]: DBClusterResources.small,
        }}
        onSubmit={jest.fn()}
        render={(renderProps: FormRenderProps) => (
          <DBClusterAdvancedOptions renderProps={renderProps} selectedCluster={dbClustersStub[0]} />
        )}
      />
    );
    const memory = root.find('[data-qa="memory-number-input"]');
    const cpu = root.find('[data-qa="cpu-number-input"]');
    const disk = root.find('[data-qa="disk-number-input"]');

    expect(memory.prop('disabled')).toBeTruthy();
    expect(cpu.prop('disabled')).toBeTruthy();
    expect(disk.prop('disabled')).toBeTruthy();
  });

  it('should enable memory and cpu when resources are custom, disk should be disabled', async () => {
    const root = await getMount(
      <Form
        initialValues={{
          [EditDBClusterFields.resources]: DBClusterResources.small,
        }}
        onSubmit={jest.fn()}
        render={(renderProps: FormRenderProps) => (
          <DBClusterAdvancedOptions renderProps={renderProps} selectedCluster={dbClustersStub[0]} />
        )}
      />
    );
    root.find('[data-qa="resources-radio-state"]').simulate('change', { target: { value: DBClusterResources.custom } });

    const memory = root.find('[data-qa="memory-number-input"]');
    const cpu = root.find('[data-qa="cpu-number-input"]');
    const disk = root.find('[data-qa="disk-number-input"]');

    expect(memory.prop('disabled')).toBeFalsy();
    expect(cpu.prop('disabled')).toBeFalsy();
    expect(disk.prop('disabled')).toBeTruthy();
  });

  it('should disable button when invalid', async () => {
    const root = await getMount(
      <Form
        onSubmit={jest.fn()}
        render={(renderProps) => (
          <DBClusterAdvancedOptions renderProps={renderProps} selectedCluster={dbClustersStub[0]} />
        )}
      />
    );
    const button = root.find('[data-qa="dbcluster-update-cluster-button"]').find('button');

    expect(button.prop('disabled')).toBeTruthy();
  });

  it('should enable button when valid', async () => {
    const root = await getMount(
      <Form
        onSubmit={jest.fn()}
        render={(renderProps) => (
          <DBClusterAdvancedOptions
            renderProps={{ ...renderProps, valid: true, pristine: false }}
            selectedCluster={dbClustersStub[0]}
          />
        )}
      />
    );
    const button = root.find('[data-qa="dbcluster-update-cluster-button"]').find('button');

    expect(button.prop('disabled')).toBeFalsy();
  });

  it('should disabled single node topology when database is MongoDB', async () => {
    const root = await getMount(
      <Form
        initialValues={{
          [EditDBClusterFields.databaseType]: {
            value: Databases.mongodb,
            key: Databases.mongodb,
          },
        }}
        onSubmit={jest.fn()}
        render={(renderProps: FormRenderProps) => (
          <DBClusterAdvancedOptions renderProps={renderProps} selectedCluster={dbClustersStub[0]} />
        )}
      />
    );
    const topology = root.find('[data-qa="topology-radio-button"]').at(1);

    expect(topology.prop('disable')).toBeUndefined();
  });

  it('should enable single node topology when database is MySQL', async () => {
    const root = await getMount(
      <Form
        initialValues={{
          [EditDBClusterFields.databaseType]: {
            value: Databases.mysql,
            key: Databases.mysql,
          },
        }}
        onSubmit={jest.fn()}
        render={(renderProps: FormRenderProps) => (
          <DBClusterAdvancedOptions renderProps={renderProps} selectedCluster={dbClustersStub[0]} />
        )}
      />
    );
    const topology = root.find('[data-qa="topology-radio-button"]').at(1);

    expect(topology.prop('disabled')).toBeFalsy();
  });
});
