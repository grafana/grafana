import React from 'react';
import { RangeSlider, Props } from './RangeSlider';
import { mount } from 'enzyme';

const sliderProps: Props = {
  min: 10,
  max: 20,
};

describe('RangeSlider', () => {
  it('renders without error', () => {
    mount(<RangeSlider {...sliderProps} />);
  });

  /**
   * Will be picked on a later stage
   */
  // it('renders correct contents', () => {
  //   const wrapper = mount(<RangeSlider {...sliderProps} />);
  //   expect(wrapper.html()).toContain('aria-valuemin="10"');
  //   expect(wrapper.html()).toContain('aria-valuemax="20"');
  //   expect(wrapper.html()).toContain('aria-valuenow="10"');
  //   expect(wrapper.html()).toContain('aria-valuenow="20"');
  // });

  // it('renders correct contents with a value', () => {
  //   const wrapper = mount(<RangeSlider {...sliderProps} value={[15, 10]} />);
  //   expect(wrapper.html()).toContain('aria-valuenow="[15, 10]"');
  //   expect(wrapper.html()).not.toContain('aria-valuenow="20"');
  //   expect(wrapper.html()).not.toContain('aria-valuenow="10"');
  // });
});
