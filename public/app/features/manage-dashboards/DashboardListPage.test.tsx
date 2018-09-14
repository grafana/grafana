import React from 'react';
import { shallow } from 'enzyme';
import { DashboardListPage, Props } from './DashboardListPage';
import { DashboardSection, NavModel } from '../../types';
import { getMockSections } from './__mocks__/manageDashboardMock';

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

  it('should render sections', () => {
    const { wrapper } = setup({
      sections: getMockSections(5),
    });

    expect(wrapper).toMatchSnapshot();
  });

  it('should show no matching sections to filtering', () => {
    const { wrapper } = setup({
      sections: getMockSections(5),
      hasFilters: true,
    });

    expect(wrapper).toMatchSnapshot();
  });
});
