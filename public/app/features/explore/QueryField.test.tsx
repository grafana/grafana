import React from 'react';
import { shallow } from 'enzyme';

import { QueryField } from './QueryField';

describe('<QueryField />', () => {
  it('renders with null initial value', () => {
    const wrapper = shallow(<QueryField initialQuery={null} />);
    expect(wrapper.find('div').exists()).toBeTruthy();
  });
  it('renders with empty initial value', () => {
    const wrapper = shallow(<QueryField initialQuery="" />);
    expect(wrapper.find('div').exists()).toBeTruthy();
  });
  it('renders with initial value', () => {
    const wrapper = shallow(<QueryField initialQuery="my query" />);
    expect(wrapper.find('div').exists()).toBeTruthy();
  });
});
