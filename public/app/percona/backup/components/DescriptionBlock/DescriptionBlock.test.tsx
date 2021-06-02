import React from 'react';
import { shallow } from 'enzyme';
import { DescriptionBlock } from './DescriptionBlock';

describe('DescriptionBlock', () => {
  it('should render description', () => {
    const wrapper = shallow(<DescriptionBlock description="sample_description" />);
    expect(wrapper.find('pre').text()).toBe('sample_description');
  });
});
