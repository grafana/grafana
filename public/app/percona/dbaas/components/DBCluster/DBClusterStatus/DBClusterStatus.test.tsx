import React from 'react';
import { mount } from 'enzyme';
import { dataTestId } from '@percona/platform-core';
import { DBCluster, DBClusterStatus as Status } from '../DBCluster.types';
import { DBClusterStatus } from './DBClusterStatus';
import { dbClustersStub } from '../__mocks__/dbClustersStubs';

describe('DBClusterStatus::', () => {
  it('renders correctly when active', () => {
    const dbCluster: DBCluster = {
      ...dbClustersStub[0],
      status: Status.ready,
      message: 'Should not render error',
      finishedSteps: 10,
      totalSteps: 10,
    };
    const root = mount(
      <DBClusterStatus dbCluster={dbCluster} setSelectedCluster={jest.fn()} setLogsModalVisible={jest.fn()} />
    );
    const span = root.find('span');

    expect(root.find(dataTestId('cluster-status-active'))).toBeTruthy();
    expect(root.find(dataTestId('cluster-status-error-message')).length).toBe(0);
    expect(span.prop('className')).toContain('active');
  });

  it('renders progress bar and error when changing', () => {
    const dbCluster: DBCluster = {
      ...dbClustersStub[0],
      status: Status.changing,
      message: 'Should render error',
      finishedSteps: 5,
      totalSteps: 10,
    };
    const root = mount(
      <DBClusterStatus dbCluster={dbCluster} setSelectedCluster={jest.fn()} setLogsModalVisible={jest.fn()} />
    );

    expect(root.find(dataTestId('cluster-status-active')).length).toBe(0);
    expect(root.find(dataTestId('cluster-progress-bar')).length).toBe(1);
    expect(root.find(dataTestId('cluster-status-error-message')).length).toBe(1);
  });

  it('renders error and progress bar when failed', () => {
    const dbCluster: DBCluster = {
      ...dbClustersStub[0],
      status: Status.failed,
      message: 'Should render error',
      finishedSteps: 10,
      totalSteps: 10,
    };
    const root = mount(
      <DBClusterStatus dbCluster={dbCluster} setSelectedCluster={jest.fn()} setLogsModalVisible={jest.fn()} />
    );

    expect(root.find(dataTestId('cluster-status-active')).length).toBe(0);
    expect(root.find(dataTestId('cluster-progress-bar')).length).toBe(1);
    expect(root.find(dataTestId('cluster-status-error-message')).length).toBe(1);
  });
});
