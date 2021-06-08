import React from 'react';
import { Form, FormRenderProps } from 'react-final-form';
import { Databases } from 'app/percona/shared/core';
import { DBClusterAdvancedOptions } from './DBClusterAdvancedOptions';
import { AddDBClusterFields } from '../AddDBClusterModal.types';
import { DBClusterResources, DBClusterTopology } from './DBClusterAdvancedOptions.types';
import { getMount } from 'app/percona/shared/helpers/testUtils';

jest.mock('../../DBCluster.service');
jest.mock('../../PSMDB.service');
jest.mock('../../XtraDB.service');

xdescribe('DBClusterAdvancedOptions::', () => {
  it('renders correctly', async () => {
    const root = await getMount(
      <Form onSubmit={jest.fn()} render={(renderProps) => <DBClusterAdvancedOptions {...renderProps} />} />
    );

    expect(root.find('[data-qa="topology-radio-state"]')).toBeTruthy();
    expect(root.find('[data-qa="nodes-number-input"]')).toBeTruthy();
    expect(root.find('[data-qa="resources-radio-button"]')).toBeTruthy();
    expect(root.find('[data-qa="memory-number-input"]')).toBeTruthy();
    expect(root.find('[data-qa="cpu-number-input"]')).toBeTruthy();
    expect(root.find('[data-qa="disk-number-input"]')).toBeTruthy();
    expect(root.find('[data-qa="dbcluster-resources-bar-memory"]')).toBeTruthy();
    expect(root.find('[data-qa="dbcluster-resources-bar-cpu"]')).toBeTruthy();
    expect(root.find('[data-qa="disk-number-input"]')).toBeTruthy();
    expect(root.find('[data-qa="step-progress-submit-button"]')).toBeTruthy();
  });
  it('renders correctly with initial values', async () => {
    const root = await getMount(
      <Form
        initialValues={{
          [AddDBClusterFields.topology]: DBClusterTopology.cluster,
          [AddDBClusterFields.nodes]: 3,
        }}
        onSubmit={jest.fn()}
        render={(renderProps: FormRenderProps) => <DBClusterAdvancedOptions {...renderProps} />}
      />
    );
    const nodes = root.find('[data-qa="nodes-number-input"]');
    const topology = root.find('[data-qa="topology-radio-state"]');

    expect(nodes.prop('value')).toBe(3);
    expect(topology.prop('value')).toEqual(DBClusterTopology.cluster);
  });
  it('should set nodes to 1 when topology is single', async () => {
    const root = await getMount(
      <Form onSubmit={jest.fn()} render={(renderProps) => <DBClusterAdvancedOptions {...renderProps} />} />
    );
    root.find('[data-qa="topology-radio-state"]').simulate('change', { target: { value: DBClusterTopology.single } });

    expect(root.find('[data-qa="single-number-input"]')).toBeTruthy();
  });
  it('should disable memory, cpu and disk when resources are not custom', async () => {
    const root = await getMount(
      <Form
        initialValues={{
          [AddDBClusterFields.resources]: DBClusterResources.small,
        }}
        onSubmit={jest.fn()}
        render={(renderProps: FormRenderProps) => <DBClusterAdvancedOptions {...renderProps} />}
      />
    );
    const memory = root.find('[data-qa="memory-number-input"]');
    const cpu = root.find('[data-qa="cpu-number-input"]');
    const disk = root.find('[data-qa="disk-number-input"]');

    expect(memory.prop('disabled')).toBeTruthy();
    expect(cpu.prop('disabled')).toBeTruthy();
    expect(disk.prop('disabled')).toBeTruthy();
  });
  it('should enable memory and cpu when resources is custom', async () => {
    const root = await getMount(
      <Form
        initialValues={{
          [AddDBClusterFields.resources]: DBClusterResources.small,
        }}
        onSubmit={jest.fn()}
        render={(renderProps: FormRenderProps) => <DBClusterAdvancedOptions {...renderProps} />}
      />
    );
    root.find('[data-qa="resources-radio-state"]').simulate('change', { target: { value: DBClusterResources.custom } });

    const memory = root.find('[data-qa="memory-number-input"]');
    const cpu = root.find('[data-qa="cpu-number-input"]');
    const disk = root.find('[data-qa="disk-number-input"]');

    expect(memory.prop('disabled')).toBeFalsy();
    expect(cpu.prop('disabled')).toBeFalsy();
    expect(disk.prop('disabled')).toBeFalsy();
  });
  it('should disabled single node topology when database is MongoDB', async () => {
    const root = await getMount(
      <Form
        initialValues={{
          [AddDBClusterFields.databaseType]: {
            value: Databases.mongodb,
            key: Databases.mongodb,
          },
        }}
        onSubmit={jest.fn()}
        render={(renderProps: FormRenderProps) => <DBClusterAdvancedOptions {...renderProps} />}
      />
    );
    const topology = root.find('[data-qa="topology-radio-button"]').at(1);

    expect(topology.prop('disable')).toBeUndefined();
  });
  it('should enable single node topology when database is MySQL', async () => {
    const root = await getMount(
      <Form
        initialValues={{
          [AddDBClusterFields.databaseType]: {
            value: Databases.mysql,
            key: Databases.mysql,
          },
        }}
        onSubmit={jest.fn()}
        render={(renderProps: FormRenderProps) => <DBClusterAdvancedOptions {...renderProps} />}
      />
    );
    const topology = root.find('[data-qa="topology-radio-button"]').at(1);

    expect(topology.prop('disabled')).toBeFalsy();
  });
});
