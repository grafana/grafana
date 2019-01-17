import React from 'react';
import { shallow } from 'enzyme';
import { TimeSeriesVMs } from '@grafana/ui';

import { Gauge, Props } from './Gauge';

jest.mock('jquery', () => ({
  plot: jest.fn(),
}));

const setup = (propOverrides?: object) => {
  const props: Props = {
    maxValue: 100,
    valueMappings: [],
    minValue: 0,
    prefix: '',
    showThresholdMarkers: true,
    showThresholdLabels: false,
    suffix: '',
    thresholds: [{ index: 0, value: -Infinity, color: '#7EB26D' }],
    unit: 'none',
    stat: 'avg',
    height: 300,
    width: 300,
    timeSeries: {} as TimeSeriesVMs,
    decimals: 0,
  };

  Object.assign(props, propOverrides);

  const wrapper = shallow(<Gauge {...props} />);
  const instance = wrapper.instance() as Gauge;

  return {
    instance,
    wrapper,
  };
};

describe('Get font color', () => {
  it('should get first threshold color when only one threshold', () => {
    const { instance } = setup({ thresholds: [{ index: 0, value: -Infinity, color: '#7EB26D' }] });

    expect(instance.getFontColor(49)).toEqual('#7EB26D');
  });

  it('should get the next threshold color if value is same as a threshold', () => {
    const { instance } = setup({
      thresholds: [
        { index: 2, value: 75, color: '#6ED0E0' },
        { index: 1, value: 50, color: '#EAB839' },
        { index: 0, value: -Infinity, color: '#7EB26D' },
      ],
    });

    expect(instance.getFontColor(50)).toEqual('#6ED0E0');
  });

  it('should get the nearest threshold color', () => {
    const { instance } = setup({
      thresholds: [
        { index: 2, value: 75, color: '#6ED0E0' },
        { index: 1, value: 50, color: '#EAB839' },
        { index: 0, value: -Infinity, color: '#7EB26D' },
      ],
    });

    expect(instance.getFontColor(6.5)).toEqual('#EAB839');
  });
});
