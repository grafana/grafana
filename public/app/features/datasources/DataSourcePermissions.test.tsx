import React from 'react';
import { shallow } from 'enzyme';
import { DataSourcePermissions, Props } from './DataSourcePermissions';
import { DataSourcePermission, DataSourcePermissionDTO } from 'app/types';
import { AclTarget, dashboardPermissionLevels } from '../../types/acl';

const setup = (propOverrides?: object) => {
  const props: Props = {
    dataSourcePermission: {} as DataSourcePermissionDTO,
    pageId: 1,
    addDataSourcePermission: jest.fn(),
    enableDataSourcePermissions: jest.fn(),
    disableDataSourcePermissions: jest.fn(),
    loadDataSourcePermissions: jest.fn(),
    removeDataSourcePermission: jest.fn(),
  };

  Object.assign(props, propOverrides);

  const wrapper = shallow(<DataSourcePermissions {...props} />);
  const instance = wrapper.instance() as DataSourcePermissions;

  return {
    wrapper,
    instance,
  };
};

describe('Render', () => {
  it('should render component', () => {
    const { wrapper } = setup();

    expect(wrapper).toMatchSnapshot();
  });

  it('should render permissions enabled', () => {
    const { wrapper } = setup({
      dataSourcePermission: {
        enabled: true,
        datasourceId: 1,
        permissions: [] as DataSourcePermission[],
      },
    });

    expect(wrapper).toMatchSnapshot();
  });
});

describe('Functions', () => {
  describe('on add permissions', () => {
    const { instance } = setup();

    it('should add permissions for team', () => {
      const mockState = {
        permission: dashboardPermissionLevels[0].value,
        teamId: 1,
        type: AclTarget.Team,
      };

      instance.onAddPermission(mockState);

      expect(instance.props.addDataSourcePermission).toHaveBeenCalledWith(1, { teamId: 1, permission: 1 });
    });

    it('should add permissions for user', () => {
      const mockState = {
        permission: dashboardPermissionLevels[0].value,
        userId: 1,
        type: AclTarget.User,
      };

      instance.onAddPermission(mockState);

      expect(instance.props.addDataSourcePermission).toHaveBeenCalledWith(1, { userId: 1, permission: 1 });
    });
  });
});
