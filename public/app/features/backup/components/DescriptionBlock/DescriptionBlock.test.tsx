import { shallow } from 'enzyme';
import React from 'react';

import { DescriptionBlock } from './DescriptionBlock';

describe('DescriptionBlock', () => {
  it('should render description', () => {
    const wrapper = shallow(<DescriptionBlock description="sample_description" />);
    expect(wrapper.find('pre').text()).toBe('sample_description');
  });
});
