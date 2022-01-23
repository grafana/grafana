import React from 'react';
import { render, screen, act, fireEvent, within } from '@testing-library/react';
import { DBClusterLogsModal } from './DBClusterLogsModal';
import { dbClustersStub } from '../__mocks__/dbClustersStubs';
import { DBClusterService } from '../__mocks__/DBCluster.service';

jest.mock('../DBCluster.service');

describe('DBClusterLogsModal::', () => {
  it('should render logs', async () => {
    act(() => {
      render(<DBClusterLogsModal isVisible setVisible={jest.fn()} dbCluster={dbClustersStub[0]} />);
    });
    const logs = await screen.findAllByTestId('dbcluster-pod-logs');
    expect(logs.length).toBeGreaterThan(0);
  });

  it('should expand logs', async () => {
    act(() => {
      render(<DBClusterLogsModal isVisible setVisible={jest.fn()} dbCluster={dbClustersStub[0]} />);
    });

    let preTags = screen.queryAllByTestId('dbcluster-pod-events');
    let logs = screen.queryAllByTestId('dbcluster-logs');

    expect(preTags).toHaveLength(0);
    expect(logs).toHaveLength(0);

    const actions = await screen.findAllByTestId('dbcluster-logs-actions');
    const expandButton = within(actions[0]).getAllByRole('button')[0];

    act(() => {
      fireEvent.click(expandButton);
    });

    logs = await screen.findAllByTestId('dbcluster-logs');
    expect(logs.length).toBeGreaterThan(0);
  });

  it('should refresh logs', async () => {
    const getLogs = jest.fn();

    act(() => {
      render(<DBClusterLogsModal isVisible setVisible={jest.fn()} dbCluster={dbClustersStub[0]} />);
    });

    DBClusterService.getLogs = getLogs();

    const actions = await screen.findAllByTestId('dbcluster-logs-actions');
    const refreshButton = within(actions[0]).getAllByRole('button')[1];

    act(() => {
      fireEvent.click(refreshButton);
    });

    await screen.findAllByTestId('dbcluster-logs-actions');

    expect(getLogs).toHaveBeenCalled();
  });
});
