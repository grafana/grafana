import React from 'react';
import { shallow } from 'enzyme';

import { Gauge, Props } from './Gauge';
import { getTheme } from '../../themes';
import { ThresholdsMode, FieldConfig, FieldColorModeId } from '@grafana/data';

jest.mock('jquery', () => ({
  plot: jest.fn(),
}));

const setup = (propOverrides?: FieldConfig) => {
  const field: FieldConfig = {
    min: 0,
    max: 100,
    color: {
      mode: FieldColorModeId.Thresholds,
    },
    thresholds: {
      mode: ThresholdsMode.Absolute,
      steps: [{ value: -Infinity, color: '#7EB26D' }],
    },
  };
  Object.assign(field, propOverrides);

  const props: Props = {
    showThresholdMarkers: true,
    showThresholdLabels: false,
    field,
    width: 300,
    height: 300,
    value: {
      text: '25',
      numeric: 25,
    },
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
    const { instance } = setup({
      thresholds: { mode: ThresholdsMode.Absolute, steps: [{ value: -Infinity, color: '#7EB26D' }] },
    });

    expect(instance.getFormattedThresholds(2)).toEqual([
      { value: 0, color: '#7EB26D' },
      { value: 100, color: '#7EB26D' },
    ]);
  });

  it('should get the correct formatted values when thresholds are added', () => {
    const { instance } = setup({
      thresholds: {
        mode: ThresholdsMode.Absolute,
        steps: [
          { value: -Infinity, color: '#7EB26D' },
          { value: 50, color: '#EAB839' },
          { value: 75, color: '#6ED0E0' },
        ],
      },
    });

    expect(instance.getFormattedThresholds(2)).toEqual([
      { value: 0, color: '#7EB26D' },
      { value: 50, color: '#7EB26D' },
      { value: 75, color: '#EAB839' },
      { value: 100, color: '#6ED0E0' },
    ]);
  });
});
