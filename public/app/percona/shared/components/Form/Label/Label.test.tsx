import React from 'react';
import { shallow } from 'enzyme';
import { Label } from './Label';

describe('Label', () => {
  it('should render', () => {
    const wrapper = shallow(<Label label="label" />);
    expect(wrapper.find('label').exists()).toBeTruthy();
  });
});
