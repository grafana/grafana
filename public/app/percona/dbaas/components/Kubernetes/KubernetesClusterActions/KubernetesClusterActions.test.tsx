import React from 'react';
import { mount } from 'enzyme';
import { dataQa } from '@percona/platform-core';
import { MultipleActions } from 'app/percona/dbaas/components/MultipleActions/MultipleActions';
import { act } from 'react-dom/test-utils';
import { KubernetesClusterActions } from './KubernetesClusterActions';
import { kubernetesStub } from '../__mocks__/kubernetesStubs';

describe('KubernetesClusterActions::', () => {
  it('renders correctly', () => {
    const root = mount(
      <KubernetesClusterActions
        kubernetesCluster={kubernetesStub[0]}
        setSelectedCluster={jest.fn()}
        setDeleteModalVisible={jest.fn()}
        setViewConfigModalVisible={jest.fn()}
        setManageComponentsModalVisible={jest.fn()}
        getDBClusters={jest.fn()}
      />
    );

    expect(root.find(MultipleActions)).toBeTruthy();
  });

  it('Select delete actions', async () => {
    const setSelectedCluster = jest.fn();
    const setDeleteModalVisible = jest.fn();
    const root = mount(
      <KubernetesClusterActions
        kubernetesCluster={kubernetesStub[1]}
        setSelectedCluster={setSelectedCluster}
        setDeleteModalVisible={setDeleteModalVisible}
        setViewConfigModalVisible={jest.fn()}
        setManageComponentsModalVisible={jest.fn()}
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

  it('Select view cluster config action', async () => {
    const setSelectedCluster = jest.fn();
    const setDeleteModalVisible = jest.fn();
    const setViewConfigModalVisible = jest.fn();

    const root = mount(
      <KubernetesClusterActions
        kubernetesCluster={kubernetesStub[1]}
        setSelectedCluster={setSelectedCluster}
        setDeleteModalVisible={setDeleteModalVisible}
        setViewConfigModalVisible={setViewConfigModalVisible}
        setManageComponentsModalVisible={jest.fn()}
        getDBClusters={jest.fn()}
      />
    );

    await act(async () => {
      const button = root.find('button');

      button.simulate('click');
    });

    root.update();

    const menu = root.find(dataQa('dropdown-menu-menu'));
    const action = menu.find('span').at(1);

    action.simulate('click');

    expect(setSelectedCluster).toHaveBeenCalled();
    expect(setViewConfigModalVisible).toHaveBeenCalled();
  });
});
