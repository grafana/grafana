import React from 'react';
import { shallow } from 'enzyme';
import { BarGauge, Props } from './BarGauge';
import { VizOrientation } from '../../types';
import { getTheme } from '../../themes';

jest.mock('jquery', () => ({
  plot: jest.fn(),
}));

const setup = (propOverrides?: object) => {
  const props: Props = {
    maxValue: 100,
    minValue: 0,
    displayMode: 'basic',
    thresholds: [{ index: 0, value: -Infinity, color: '#7EB26D' }],
    height: 300,
    width: 300,
    value: {
      text: '25',
      numeric: 25,
    },
    theme: getTheme(),
    orientation: VizOrientation.Horizontal,
  };

  Object.assign(props, propOverrides);

  const wrapper = shallow(<BarGauge {...props} />);
  const instance = wrapper.instance() as BarGauge;

  return {
    instance,
    wrapper,
  };
};

describe('Get font color', () => {
  it('should get first threshold color when only one threshold', () => {
    const { instance } = setup({ thresholds: [{ index: 0, value: -Infinity, color: '#7EB26D' }] });

    expect(instance.getValueColors().value).toEqual('#7EB26D');
  });

  it('should get the threshold color if value is same as a threshold', () => {
    const { instance } = setup({
      thresholds: [
        { index: 2, value: 75, color: '#6ED0E0' },
        { index: 1, value: 10, color: '#EAB839' },
        { index: 0, value: -Infinity, color: '#7EB26D' },
      ],
    });

    expect(instance.getValueColors().value).toEqual('#EAB839');
  });
});

describe('Render BarGauge with basic options', () => {
  it('should render', () => {
    const { wrapper } = setup();
    expect(wrapper).toMatchSnapshot();
  });
});
