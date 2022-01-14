import React from 'react';
import { act } from 'react-dom/test-utils';
import { mount, ReactWrapper } from 'enzyme';
import { DBClusterParameters } from './DBClusterParameters';
import { dbClustersStub } from '../__mocks__/dbClustersStubs';

jest.mock('app/core/app_events');
jest.mock('../XtraDB.service');
jest.mock('../PSMDB.service');

describe('DBClusterParameters::', () => {
  it('renders parameters items correctly', async () => {
    let root: ReactWrapper;

    await act(async () => {
      root = mount(<DBClusterParameters dbCluster={dbClustersStub[0]} />);
    });

    expect(root.find('[data-qa="cluster-parameters-cluster-name"]')).toBeTruthy();

    const memory = root.find('[data-qa="cluster-parameters-memory"]');
    const cpu = root.find('[data-qa="cluster-parameters-cpu"]');
    const disk = root.find('[data-qa="cluster-parameters-disk"]');

    expect(memory).toBeTruthy();
    expect(memory.text()).toContain('Memory:1024 GB');
    expect(cpu).toBeTruthy();
    expect(cpu.text()).toContain('CPU:1');
    expect(disk).toBeTruthy();
    expect(disk.text()).toContain('Disk:25 GB');
  });

  it('renders parameters items correctly with MongoDB cluster', async () => {
    let root: ReactWrapper;

    await act(async () => {
      root = mount(<DBClusterParameters dbCluster={dbClustersStub[2]} />);
    });

    root.update();

    expect(root.find('[data-qa="cluster-parameters-cluster-name"]')).toBeTruthy();

    const memory = root.find('[data-qa="cluster-parameters-memory"]');
    const cpu = root.find('[data-qa="cluster-parameters-cpu"]');
    const disk = root.find('[data-qa="cluster-parameters-disk"]');

    expect(memory).toBeTruthy();
    expect(memory.text()).toContain('Memory:0 GB');
    expect(cpu).toBeTruthy();
    expect(cpu.text()).toContain('CPU:0');
    expect(disk).toBeTruthy();
    expect(disk.text()).toContain('Disk:25 GB');
  });
});
