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

  it('allows for custom values to be set in the input', () => {
    console.log('something');
    const wrapper = mount(<Slider {...sliderProps} value={10} min={10} max={100} />);
    const sliderInput = wrapper.find('input');
    sliderInput.simulate('focus');
    sliderInput.simulate('change', { target: { value: 50 } });
    sliderInput.simulate('blur');
    expect(wrapper.html()).toContain('aria-valuenow="50"');
  });
});
