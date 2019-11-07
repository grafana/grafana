import React from 'react';
import { shallow } from 'enzyme';
import { QueryField } from './QueryField';

describe('<QueryField />', () => {
  it('should render with null initial value', () => {
    const wrapper = shallow(<QueryField query={null} onTypeahead={jest.fn()} portalOrigin="mock-origin" />);
    expect(wrapper.find('div').exists()).toBeTruthy();
  });

  it('should render with empty initial value', () => {
    const wrapper = shallow(<QueryField query="" onTypeahead={jest.fn()} portalOrigin="mock-origin" />);
    expect(wrapper.find('div').exists()).toBeTruthy();
  });

  it('should render with initial value', () => {
    const wrapper = shallow(<QueryField query="my query" onTypeahead={jest.fn()} portalOrigin="mock-origin" />);
    expect(wrapper.find('div').exists()).toBeTruthy();
  });
});
