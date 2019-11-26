import React from 'react';
import { shallow } from 'enzyme';
import { DisplayValue } from '@grafana/data';
import { BigValue, Props, BigValueColorMode, BigValueGraphMode } from './BigValue';
import { VizOrientation } from '@grafana/data';
import { getTheme } from '../../themes';

const green = '#73BF69';
const orange = '#FF9830';
// const red = '#BB';

function getProps(propOverrides?: Partial<Props>): Props {
  const props: Props = {
    maxValue: 100,
    minValue: 0,
    colorMode: BigValueColorMode.Background,
    graphMode: BigValueColorMode.Line,
    thresholds: [
      { value: -Infinity, color: 'green' },
      { value: 70, color: 'orange' },
      { value: 90, color: 'red' },
    ],
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
  return props;
}

const setup = (propOverrides?: object) => {
  const props = getProps(propOverrides);
  const wrapper = shallow(<BigValue {...props} />);
  const instance = wrapper.instance() as BarGauge;

  return {
    instance,
    wrapper,
  };
};

function getValue(value: number, title?: string): DisplayValue {
  return { numeric: value, text: value.toString(), title: title };
}

describe('BigValue', () => {
  describe('Render with basic options', () => {
    it('should render', () => {
      const { wrapper } = setup();
      expect(wrapper).toMatchSnapshot();
    });
  });
});
