import { shallow } from 'enzyme';
import React from 'react';

import { Label } from './Label';

describe('Label', () => {
  it('should render', () => {
    const wrapper = shallow(<Label label="label" />);
    expect(wrapper.find('label').exists()).toBeTruthy();
  });
});
