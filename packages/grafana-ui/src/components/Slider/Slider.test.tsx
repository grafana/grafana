import React from 'react';
import { Slider, Props } from './Slider';
import { getTheme } from '../../themes';
import { mount } from 'enzyme';

const sliderProps: Props = {
  orientation: 'vertical',
  min: 10,
  max: 20,
  onChange: () => {},
  theme: getTheme(),
};

describe('Slider', () => {
  it('renders correct html', () => {
    const wrapper = mount(<Slider {...sliderProps} />);
    expect(wrapper.html()).toMatchSnapshot();
  });
});
