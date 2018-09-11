import React from 'react';
import { shallow } from 'enzyme';
import { DashboardListPage, Props } from './DashboardListPage';

const setup = (propOverrides?: object) => {
  const props: Props = {};

  const wrapper = shallow(<DashboardListPage {...props} />);
  const instance = wrapper.instance() as DashboardListPage;

  return {
    wrapper,
    instance,
  };
};
