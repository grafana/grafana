import React from 'react';
import { dataQa } from '@percona/platform-core';
import { DBClusterLogsModal } from './DBClusterLogsModal';
import { dbClustersStub } from '../__mocks__/dbClustersStubs';
import { DBClusterService } from '../__mocks__/DBCluster.service';
import { getMount, asyncAct } from 'app/percona/shared/helpers/testUtils';

jest.mock('../DBCluster.service');

describe('DBClusterLogsModal::', () => {
  it('should render logs', async () => {
    const root = await getMount(<DBClusterLogsModal isVisible setVisible={jest.fn()} dbCluster={dbClustersStub[0]} />);

    root.update();
    expect(root.find(dataQa('dbcluster-pod-logs')).length).toBeGreaterThan(0);
  });
  it('should expand logs', async () => {
    const root = await getMount(<DBClusterLogsModal isVisible setVisible={jest.fn()} dbCluster={dbClustersStub[0]} />);

    root.update();

    expect(root).not.toContain('pre');
    expect(root.find(dataQa('dbcluster-logs')).length).toBe(0);

    const expandButton = root.find(dataQa('dbcluster-logs-actions')).find('button').at(0);

    await asyncAct(() => expandButton.simulate('click'));

    root.update();

    expect(root.find(dataQa('dbcluster-logs')).length).toBeGreaterThan(0);
  });
  it('should refresh logs', async () => {
    const getLogs = jest.fn();
    const root = await getMount(<DBClusterLogsModal isVisible setVisible={jest.fn()} dbCluster={dbClustersStub[0]} />);

    root.update();

    DBClusterService.getLogs = getLogs();

    const refreshButton = root.find(dataQa('dbcluster-logs-actions')).find('button').at(1);

    await asyncAct(() => refreshButton.simulate('click'));

    expect(getLogs).toHaveBeenCalled();
  });
});
