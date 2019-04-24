import React from 'react';
import { shallow } from 'enzyme';

import { Gauge, Props } from './Gauge';
import { getTheme } from '../../themes';

jest.mock('jquery', () => ({
  plot: jest.fn(),
}));

const setup = (propOverrides?: object) => {
  const props: Props = {
    maxValue: 100,
    minValue: 0,
    showThresholdMarkers: true,
    showThresholdLabels: false,
    thresholds: [{ index: 0, value: -Infinity, color: '#7EB26D' }],
    height: 300,
    width: 300,
    value: {
      text: '25',
      numeric: 25,
    },
    theme: getTheme(),
  };

  Object.assign(props, propOverrides);

  const wrapper = shallow(<Gauge {...props} />);
  const instance = wrapper.instance() as Gauge;

  return {
    instance,
    wrapper,
  };
};

describe('Get thresholds formatted', () => {
  it('should return first thresholds color for min and max', () => {
    const { instance } = setup({ thresholds: [{ index: 0, value: -Infinity, color: '#7EB26D' }] });

    expect(instance.getFormattedThresholds()).toEqual([
      { value: 0, color: '#7EB26D' },
      { value: 100, color: '#7EB26D' },
    ]);
  });

  it('should get the correct formatted values when thresholds are added', () => {
    const { instance } = setup({
      thresholds: [
        { index: 0, value: -Infinity, color: '#7EB26D' },
        { index: 1, value: 50, color: '#EAB839' },
        { index: 2, value: 75, color: '#6ED0E0' },
      ],
    });

    expect(instance.getFormattedThresholds()).toEqual([
      { value: 0, color: '#7EB26D' },
      { value: 50, color: '#7EB26D' },
      { value: 75, color: '#EAB839' },
      { value: 100, color: '#6ED0E0' },
    ]);
  });
});
