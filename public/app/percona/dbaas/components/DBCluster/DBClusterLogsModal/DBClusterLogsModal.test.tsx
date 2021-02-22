import React from 'react';
import { mount, ReactWrapper } from 'enzyme';
import { act } from 'react-dom/test-utils';
import { dataQa } from '@percona/platform-core';
import { DBClusterLogsModal } from './DBClusterLogsModal';
import { dbClustersStub } from '../__mocks__/dbClustersStubs';
import { DBClusterService } from '../__mocks__/DBCluster.service';

jest.mock('../DBCluster.service');

describe('DBClusterLogsModal::', () => {
  it('should render logs', async () => {
    let root: ReactWrapper;

    await act(async () => {
      root = mount(<DBClusterLogsModal isVisible setVisible={jest.fn()} dbCluster={dbClustersStub[0]} />);
    });

    root.update();
    expect(root.find(dataQa('dbcluster-pod-logs')).length).toBeGreaterThan(0);
  });
  it('should expand logs', async () => {
    let root: ReactWrapper;

    await act(async () => {
      root = mount(<DBClusterLogsModal isVisible setVisible={jest.fn()} dbCluster={dbClustersStub[0]} />);
    });

    root.update();

    expect(root).not.toContain('pre');
    expect(root.find(dataQa('dbcluster-logs')).length).toBe(0);

    const expandButton = root
      .find(dataQa('dbcluster-logs-actions'))
      .find('button')
      .at(0);

    await act(async () => {
      expandButton.simulate('click');
    });

    root.update();

    expect(root.find(dataQa('dbcluster-logs')).length).toBeGreaterThan(0);
  });
  it('should refresh logs', async () => {
    const getLogs = jest.fn();
    let root: ReactWrapper;

    await act(async () => {
      root = mount(<DBClusterLogsModal isVisible setVisible={jest.fn()} dbCluster={dbClustersStub[0]} />);
    });

    root.update();

    DBClusterService.getLogs = getLogs();

    const refreshButton = root
      .find(dataQa('dbcluster-logs-actions'))
      .find('button')
      .at(1);

    await act(async () => {
      refreshButton.simulate('click');
    });

    expect(getLogs).toHaveBeenCalled();
  });
});
