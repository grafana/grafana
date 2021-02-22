import React from 'react';
import { mount, shallow } from 'enzyme';
import { dataQa } from '@percona/platform-core';
import { MultipleActions } from 'app/percona/dbaas/components/MultipleActions/MultipleActions';
import { act } from 'react-dom/test-utils';
import { dbClustersStub } from '../__mocks__/dbClustersStubs';
import { DBClusterActions } from './DBClusterActions';

jest.mock('app/core/app_events');
jest.mock('../XtraDB.service');

describe('DBClusterActions::', () => {
  it('renders correctly', () => {
    const root = shallow(
      <DBClusterActions
        dbCluster={dbClustersStub[0]}
        setSelectedCluster={jest.fn()}
        setDeleteModalVisible={jest.fn()}
        setEditModalVisible={jest.fn()}
        setLogsModalVisible={jest.fn()}
        getDBClusters={jest.fn()}
      />
    );

    expect(root.find(MultipleActions)).toBeTruthy();
  });

  it('doesnt disable button if cluster is ready', () => {
    const root = mount(
      <DBClusterActions
        dbCluster={dbClustersStub[0]}
        setSelectedCluster={jest.fn()}
        setDeleteModalVisible={jest.fn()}
        setEditModalVisible={jest.fn()}
        setLogsModalVisible={jest.fn()}
        getDBClusters={jest.fn()}
      />
    );

    expect(root.find('button').prop('disabled')).toBeFalsy();
  });

  it('calls delete action correctly', async () => {
    const setSelectedCluster = jest.fn();
    const setDeleteModalVisible = jest.fn();
    const root = mount(
      <DBClusterActions
        dbCluster={dbClustersStub[0]}
        setSelectedCluster={setSelectedCluster}
        setDeleteModalVisible={setDeleteModalVisible}
        setEditModalVisible={jest.fn()}
        setLogsModalVisible={jest.fn()}
        getDBClusters={jest.fn()}
      />
    );

    await act(async () => {
      const button = root.find('button');

      button.simulate('click');
    });

    root.update();

    const menu = root.find(dataQa('dropdown-menu-menu'));
    const action = menu.find('span').at(0);

    action.simulate('click');

    expect(setSelectedCluster).toHaveBeenCalled();
    expect(setDeleteModalVisible).toHaveBeenCalled();
  });

  it('delete action is disabled if cluster is deleting', async () => {
    const setSelectedCluster = jest.fn();
    const setDeleteModalVisible = jest.fn();
    const root = mount(
      <DBClusterActions
        dbCluster={dbClustersStub[3]}
        setSelectedCluster={setSelectedCluster}
        setDeleteModalVisible={setDeleteModalVisible}
        setEditModalVisible={jest.fn()}
        setLogsModalVisible={jest.fn()}
        getDBClusters={jest.fn()}
      />
    );

    await act(async () => {
      const button = root.find('button');

      button.simulate('click');
    });

    root.update();

    const menu = root.find(dataQa('dropdown-menu-menu'));
    const action = menu.find('span').at(0);

    action.simulate('click');

    expect(setSelectedCluster).toHaveBeenCalled();
    expect(setDeleteModalVisible).toHaveBeenCalled();
  });

  xit('calls restart action correctly', async () => {
    const getDBClusters = jest.fn();
    const root = mount(
      <DBClusterActions
        dbCluster={dbClustersStub[0]}
        setSelectedCluster={jest.fn()}
        setDeleteModalVisible={jest.fn()}
        setEditModalVisible={jest.fn()}
        setLogsModalVisible={jest.fn()}
        getDBClusters={getDBClusters}
      />
    );

    await act(async () => {
      const button = root.find('button');

      button.simulate('click');
    });

    root.update();

    const menu = root.find(dataQa('dropdown-menu-menu'));

    await act(async () => {
      const action = menu.find('span').at(1);

      action.simulate('click');
    });

    expect(getDBClusters).toHaveBeenCalled();
  });
});
