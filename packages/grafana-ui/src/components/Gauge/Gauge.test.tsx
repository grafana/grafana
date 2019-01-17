import React from 'react';
import { shallow } from 'enzyme';

import { Gauge, Props } from './Gauge';
import { TimeSeriesVMs } from '../../types/series';
import { ValueMapping, MappingType } from '../../types';

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

describe('Format value with value mappings', () => {
  it('should return undefined with no valuemappings', () => {
    const valueMappings: ValueMapping[] = [];
    const value = 10;
    const { instance } = setup({ valueMappings });

    const result = instance.getFirstFormattedValueMapping(valueMappings, value);

    expect(result).toBeUndefined();
  });

  it('should return undefined with no matching valuemappings', () => {
    const valueMappings: ValueMapping[] = [
      { id: 0, operator: '', text: 'elva', type: MappingType.ValueToText, value: '11' },
      { id: 1, operator: '', text: '1-9', type: MappingType.RangeToText, from: '1', to: '9' },
    ];
    const value = 10;
    const { instance } = setup({ valueMappings });

    const result = instance.getFirstFormattedValueMapping(valueMappings, value);

    expect(result).toBeUndefined();
  });

  it('should return first matching mapping with lowest id', () => {
    const valueMappings: ValueMapping[] = [
      { id: 0, operator: '', text: '1-20', type: MappingType.RangeToText, from: '1', to: '20' },
      { id: 1, operator: '', text: 'tio', type: MappingType.ValueToText, value: '10' },
    ];
    const value = 10;
    const { instance } = setup({ valueMappings });

    const result = instance.getFirstFormattedValueMapping(valueMappings, value);

    expect(result.text).toEqual('1-20');
  });

  it('should return rangeToText mapping where value equals to', () => {
    const valueMappings: ValueMapping[] = [
      { id: 0, operator: '', text: '1-10', type: MappingType.RangeToText, from: '1', to: '10' },
      { id: 1, operator: '', text: 'elva', type: MappingType.ValueToText, value: '11' },
    ];
    const value = 10;
    const { instance } = setup({ valueMappings });

    const result = instance.getFirstFormattedValueMapping(valueMappings, value);

    expect(result.text).toEqual('1-10');
  });

  it('should return rangeToText mapping where value equals from', () => {
    const valueMappings: ValueMapping[] = [
      { id: 0, operator: '', text: '10-20', type: MappingType.RangeToText, from: '10', to: '20' },
      { id: 1, operator: '', text: 'elva', type: MappingType.ValueToText, value: '11' },
    ];
    const value = 10;
    const { instance } = setup({ valueMappings });

    const result = instance.getFirstFormattedValueMapping(valueMappings, value);

    expect(result.text).toEqual('10-20');
  });

  it('should return rangeToText mapping where value is between from and to', () => {
    const valueMappings: ValueMapping[] = [
      { id: 0, operator: '', text: '1-20', type: MappingType.RangeToText, from: '1', to: '20' },
      { id: 1, operator: '', text: 'elva', type: MappingType.ValueToText, value: '11' },
    ];
    const value = 10;
    const { instance } = setup({ valueMappings });

    const result = instance.getFirstFormattedValueMapping(valueMappings, value);

    expect(result.text).toEqual('1-20');
  });
});
