import React from 'react';
import { DBCluster, DBClusterStatus as Status } from '../DBCluster.types';
import { DBClusterStatus } from './DBClusterStatus';
import { dbClustersStub } from '../__mocks__/dbClustersStubs';
import { render, screen } from '@testing-library/react';

describe('DBClusterStatus::', () => {
  it('renders correctly when active', () => {
    const dbCluster: DBCluster = {
      ...dbClustersStub[0],
      status: Status.ready,
      message: 'Should not render error',
      finishedSteps: 10,
      totalSteps: 10,
    };
    const { container } = render(
      <DBClusterStatus dbCluster={dbCluster} setSelectedCluster={jest.fn()} setLogsModalVisible={jest.fn()} />
    );

    expect(screen.getByTestId('cluster-status-active')).toBeInTheDocument();
    expect(screen.queryByTestId('cluster-status-error-message')).not.toBeInTheDocument();
    expect(container.querySelector('span')?.className).toContain('active');
  });

  it('renders progress bar and error when changing', () => {
    const dbCluster: DBCluster = {
      ...dbClustersStub[0],
      status: Status.changing,
      message: 'Should render error',
      finishedSteps: 5,
      totalSteps: 10,
    };
    render(<DBClusterStatus dbCluster={dbCluster} setSelectedCluster={jest.fn()} setLogsModalVisible={jest.fn()} />);

    expect(screen.queryByTestId('cluster-status-active')).not.toBeInTheDocument();
    expect(screen.getByTestId('cluster-progress-bar')).toBeInTheDocument();
    expect(screen.getByTestId('cluster-status-error-message')).toBeInTheDocument();
  });

  it('renders error and progress bar when failed', () => {
    const dbCluster: DBCluster = {
      ...dbClustersStub[0],
      status: Status.failed,
      message: 'Should render error',
      finishedSteps: 10,
      totalSteps: 10,
    };
    render(<DBClusterStatus dbCluster={dbCluster} setSelectedCluster={jest.fn()} setLogsModalVisible={jest.fn()} />);

    expect(screen.queryByTestId('cluster-status-active')).not.toBeInTheDocument();
    expect(screen.getByTestId('cluster-progress-bar')).toBeInTheDocument();
    expect(screen.getByTestId('cluster-status-error-message')).toBeInTheDocument();
  });
});
