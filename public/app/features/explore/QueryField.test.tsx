import React from 'react';
import { shallow } from 'enzyme';
import { QueryField } from './QueryField';

describe('<QueryField />', () => {
  it('should render with null initial value', () => {
    const wrapper = shallow(<QueryField initialQuery={null} />);
    expect(wrapper.find('div').exists()).toBeTruthy();
  });

  it('should render with empty initial value', () => {
    const wrapper = shallow(<QueryField initialQuery="" />);
    expect(wrapper.find('div').exists()).toBeTruthy();
  });

  it('should render with initial value', () => {
    const wrapper = shallow(<QueryField initialQuery="my query" />);
    expect(wrapper.find('div').exists()).toBeTruthy();
  });
});
