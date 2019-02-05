import React from 'react';
import { shallow } from 'enzyme';

import { Gauge, Props } from './Gauge';
import { ValueMapping, MappingType } from '../../types';
import { getTheme } from '../../themes';

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
    value: 25,
    decimals: 0,
    theme: getTheme()
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

  it('should get the threshold color if value is same as a threshold', () => {
    const { instance } = setup({
      thresholds: [
        { index: 2, value: 75, color: '#6ED0E0' },
        { index: 1, value: 50, color: '#EAB839' },
        { index: 0, value: -Infinity, color: '#7EB26D' },
      ],
    });

    expect(instance.getFontColor(50)).toEqual('#EAB839');
  });

  it('should get the nearest threshold color between thresholds', () => {
    const { instance } = setup({
      thresholds: [
        { index: 2, value: 75, color: '#6ED0E0' },
        { index: 1, value: 50, color: '#EAB839' },
        { index: 0, value: -Infinity, color: '#7EB26D' },
      ],
    });

    expect(instance.getFontColor(55)).toEqual('#EAB839');
  });
});

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
        { index: 2, value: 75, color: '#6ED0E0' },
        { index: 1, value: 50, color: '#EAB839' },
        { index: 0, value: -Infinity, color: '#7EB26D' },
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

describe('Format value', () => {
  it('should return if value isNaN', () => {
    const valueMappings: ValueMapping[] = [];
    const value = 'N/A';
    const { instance } = setup({ valueMappings });

    const result = instance.formatValue(value);

    expect(result).toEqual('N/A');
  });

  it('should return formatted value if there are no value mappings', () => {
    const valueMappings: ValueMapping[] = [];
    const value = '6';
    const { instance } = setup({ valueMappings, decimals: 1 });

    const result = instance.formatValue(value);

    expect(result).toEqual('6.0');
  });

  it('should return formatted value if there are no matching value mappings', () => {
    const valueMappings: ValueMapping[] = [
      { id: 0, operator: '', text: 'elva', type: MappingType.ValueToText, value: '11' },
      { id: 1, operator: '', text: '1-9', type: MappingType.RangeToText, from: '1', to: '9' },
    ];
    const value = '10';
    const { instance } = setup({ valueMappings, decimals: 1 });

    const result = instance.formatValue(value);

    expect(result).toEqual('10.0');
  });

  it('should return mapped value if there are matching value mappings', () => {
    const valueMappings: ValueMapping[] = [
      { id: 0, operator: '', text: '1-20', type: MappingType.RangeToText, from: '1', to: '20' },
      { id: 1, operator: '', text: 'elva', type: MappingType.ValueToText, value: '11' },
    ];
    const value = '11';
    const { instance } = setup({ valueMappings, decimals: 1 });

    const result = instance.formatValue(value);

    expect(result).toEqual('1-20');
  });
});
