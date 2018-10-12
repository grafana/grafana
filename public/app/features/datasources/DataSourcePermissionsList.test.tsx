import React from 'react';
import { shallow } from 'enzyme';
import { DataSourcePermissionsList, Props } from './DataSourcePermissionsList';
import { DataSourcePermission } from '../../types';
import { getMockDataSourcePermissionsTeam, getMockDataSourcePermissionsUser } from './__mocks__/dataSourcesMocks';

const setup = (propOverrides?: object) => {
  const props: Props = {
    items: [] as DataSourcePermission[],
    onRemoveItem: jest.fn(),
  };

  Object.assign(props, propOverrides);

  return shallow(<DataSourcePermissionsList {...props} />);
};

describe('Render', () => {
  it('should render component', () => {
    const wrapper = setup();

    expect(wrapper).toMatchSnapshot();
  });

  it('should render items', () => {
    const wrapper = setup({
      items: [getMockDataSourcePermissionsUser(), getMockDataSourcePermissionsTeam()],
    });

    expect(wrapper).toMatchSnapshot();
  });
});
