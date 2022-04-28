import { mount } from 'enzyme';
import React from 'react';

import { Slider } from './Slider';
import { SliderProps } from './types';

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
    const wrapper = mount(<Slider {...sliderProps} value={10} min={10} max={100} />);
    const sliderInput = wrapper.find('input');
    sliderInput.simulate('focus');
    sliderInput.simulate('change', { target: { value: 50 } });
    sliderInput.simulate('blur');
    expect(wrapper.html()).toContain('aria-valuenow="50"');
  });

  it('defaults after blur if input value is outside of range', () => {
    const wrapper = mount(<Slider {...sliderProps} value={10} min={10} max={100} />);
    const sliderInput = wrapper.find('input');
    sliderInput.simulate('focus');
    sliderInput.simulate('change', { target: { value: 200 } });
    // re-grab to check value is out of range before blur
    const sliderInputIncorrect = wrapper.find('input');
    expect(sliderInputIncorrect.get(0).props.value).toEqual('200');

    sliderInput.simulate('blur');
    expect(wrapper.html()).toContain('aria-valuenow="100"');
    // re-grab to check value is back inside range
    const sliderInputCorrect = wrapper.find('input');
    expect(sliderInputCorrect.get(0).props.value).toEqual('100');
  });
});
