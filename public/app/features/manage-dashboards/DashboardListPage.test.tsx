import React from 'react';
import { shallow } from 'enzyme';
import { DashboardListPage, Props } from './DashboardListPage';
import { DashboardSection, NavModel } from '../../types';

const setup = (propOverrides?: object) => {
  const props: Props = {
    navModel: {} as NavModel,
    hasFilters: false,
    sections: [] as DashboardSection[],
    folderId: 0,
    loadDashboardListItems: jest.fn(),
  };

  Object.assign(props, propOverrides);

  const wrapper = shallow(<DashboardListPage {...props} />);
  const instance = wrapper.instance() as DashboardListPage;

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

  it('should show filters if true', () => {
    const { wrapper } = setup({
      hasFilters: true,
    });

    expect(wrapper).toMatchSnapshot();
  });
});
