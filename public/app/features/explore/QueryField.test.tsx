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

  it('should execute query when enter is pressed and there are no suggestions visible', () => {
    const wrapper = shallow(<QueryField initialQuery="my query" />);
    const instance = wrapper.instance() as QueryField;
    instance.executeOnChangeAndRunQueries = jest.fn();
    const handleEnterAndTabKeySpy = jest.spyOn(instance, 'handleEnterKey');
    instance.onKeyDown({ key: 'Enter', preventDefault: () => {} } as KeyboardEvent, {});
    expect(handleEnterAndTabKeySpy).toBeCalled();
    expect(instance.executeOnChangeAndRunQueries).toBeCalled();
  });
});
