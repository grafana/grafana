import React from 'react';
import { shallow } from 'enzyme';

import { Gauge, Props } from './Gauge';
import { getTheme } from '../../themes';
import { getFieldDisplayProcessor } from '../../utils/scale';
import { Threshold } from '../../types/scale';

jest.mock('jquery', () => ({
  plot: jest.fn(),
}));

const setup = (thresholds?: Threshold[]) => {
  const field = {
    name: 'test',
    min: 0,
    max: 100,
    scale: {
      thresholds: thresholds ? thresholds : [{ index: 0, value: -Infinity, color: '#7EB26D' }],
    },
  };

  const props: Props = {
    showThresholdMarkers: true,
    showThresholdLabels: false,
    height: 300,
    width: 300,
    value: {
      text: '25',
      numeric: 25,
    },
    field: getFieldDisplayProcessor(field, getTheme()),
    theme: getTheme(),
  };

  const wrapper = shallow(<Gauge {...props} />);
  const instance = wrapper.instance() as Gauge;

  return {
    instance,
    wrapper,
  };
};

describe('Get thresholds formatted', () => {
  it('should return first thresholds color for min and max', () => {
    const { instance } = setup([{ value: -Infinity, color: '#7EB26D' }]);

    expect(instance.getFormattedThresholds()).toEqual([
      { value: 0, color: '#7EB26D' },
      { value: 100, color: '#7EB26D' },
    ]);
  });

  it('should get the correct formatted values when thresholds are added', () => {
    const { instance } = setup([
      { value: -Infinity, color: '#7EB26D' },
      { value: 50, color: '#EAB839' },
      { value: 75, color: '#6ED0E0' },
    ]);

    expect(instance.getFormattedThresholds()).toEqual([
      { value: 0, color: '#7EB26D' },
      { value: 50, color: '#7EB26D' },
      { value: 75, color: '#EAB839' },
      { value: 100, color: '#6ED0E0' },
    ]);
  });
});
