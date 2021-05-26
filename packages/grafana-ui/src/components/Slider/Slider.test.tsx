import React from 'react';
import { Slider } from './Slider';
import { SliderProps } from './types';
import { mount } from 'enzyme';

const sliderProps: SliderProps = {
  min: 10,
  max: 20,
};

describe('Slider', () => {
  it('renders without error', () => {
    mount(<Slider {...sliderProps} />);
  });

  it('renders correct contents', () => {
    const wrapper = mount(<Slider {...sliderProps} />);
    expect(wrapper.html()).toContain('aria-valuemin="10"');
    expect(wrapper.html()).toContain('aria-valuemax="20"');
    expect(wrapper.html()).toContain('aria-valuenow="10"');
  });

  it('renders correct contents with a value', () => {
    const wrapper = mount(<Slider {...sliderProps} value={15} />);
    expect(wrapper.html()).toContain('aria-valuenow="15"');
    expect(wrapper.html()).not.toContain('aria-valuenow="20"');
    expect(wrapper.html()).not.toContain('aria-valuenow="10"');
  });
});
