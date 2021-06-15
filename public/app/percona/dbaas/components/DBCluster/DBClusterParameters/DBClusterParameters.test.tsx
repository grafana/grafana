import React from 'react';
import { dataQa } from '@percona/platform-core';
import { DBClusterParameters } from './DBClusterParameters';
import { dbClustersStub } from '../__mocks__/dbClustersStubs';
import { getMount } from 'app/percona/shared/helpers/testUtils';

jest.mock('app/core/app_events');
jest.mock('../XtraDB.service');
jest.mock('../PSMDB.service');

describe('DBClusterParameters::', () => {
  it('renders parameters items correctly', async () => {
    const root = await getMount(<DBClusterParameters dbCluster={dbClustersStub[0]} />);

    expect(root.find(dataQa('cluster-parameters-cluster-name'))).toBeTruthy();

    const memory = root.find(dataQa('cluster-parameters-memory'));
    const cpu = root.find(dataQa('cluster-parameters-cpu'));
    const disk = root.find(dataQa('cluster-parameters-disk'));
    const expose = root.find(dataQa('cluster-parameters-expose'));

    expect(memory).toBeTruthy();
    expect(memory.text()).toContain('Memory:1024 GB');
    expect(cpu).toBeTruthy();
    expect(cpu.text()).toContain('CPU:1');
    expect(disk).toBeTruthy();
    expect(disk.text()).toContain('Disk:25 GB');
    expect(expose).toBeTruthy();
    expect(expose.text()).toContain('External Access:Enabled');
  });

  it('renders parameters items correctly with MongoDB cluster', async () => {
    const root = await getMount(<DBClusterParameters dbCluster={dbClustersStub[2]} />);

    root.update();

    expect(root.find(dataQa('cluster-parameters-cluster-name'))).toBeTruthy();

    const memory = root.find(dataQa('cluster-parameters-memory'));
    const cpu = root.find(dataQa('cluster-parameters-cpu'));
    const disk = root.find(dataQa('cluster-parameters-disk'));
    const expose = root.find(dataQa('cluster-parameters-expose'));

    expect(memory).toBeTruthy();
    expect(memory.text()).toContain('Memory:0 GB');
    expect(cpu).toBeTruthy();
    expect(cpu.text()).toContain('CPU:0');
    expect(disk).toBeTruthy();
    expect(disk.text()).toContain('Disk:25 GB');
    expect(expose).toBeTruthy();
    expect(expose.text()).toContain('External Access:Disabled');
  });
});
