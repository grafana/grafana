import React from 'react';
import { shallow } from 'enzyme';
import { BarGauge, Props, getValueColor, getBasicAndGradientStyles, getBarGradient, getTitleStyles } from './BarGauge';
import { VizOrientation, DisplayValue } from '../../types';
import { getTheme } from '../../themes';

// jest.mock('jquery', () => ({
//   plot: jest.fn(),
// }));

const green = '#73BF69';
const orange = '#FF9830';
// const red = '#BB';

function getProps(propOverrides?: Partial<Props>): Props {
  const props: Props = {
    maxValue: 100,
    minValue: 0,
    displayMode: 'basic',
    thresholds: [
      { index: 0, value: -Infinity, color: 'green' },
      { index: 1, value: 70, color: 'orange' },
      { index: 2, value: 90, color: 'red' },
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
  const wrapper = shallow(<BarGauge {...props} />);
  const instance = wrapper.instance() as BarGauge;

  return {
    instance,
    wrapper,
  };
};

function getValue(value: number, title?: string): DisplayValue {
  return { numeric: value, text: value.toString(), title: title };
}

describe('BarGauge', () => {
  describe('Get value color', () => {
    it('should get the threshold color if value is same as a threshold', () => {
      const props = getProps({ value: getValue(70) });
      expect(getValueColor(props)).toEqual(orange);
    });
    it('should get the base threshold', () => {
      const props = getProps({ value: getValue(-10) });
      expect(getValueColor(props)).toEqual(green);
    });
  });

  describe('Vertical bar without title', () => {
    it('should not include title height in height', () => {
      const props = getProps({
        height: 300,
        value: getValue(100),
        orientation: VizOrientation.Vertical,
      });
      const styles = getBasicAndGradientStyles(props);
      expect(styles.bar.height).toBe('270px');
    });
  });

  describe('Vertical bar with title', () => {
    it('should include title height in height', () => {
      const props = getProps({
        height: 300,
        value: getValue(100, 'ServerA'),
        orientation: VizOrientation.Vertical,
      });
      const styles = getBasicAndGradientStyles(props);
      expect(styles.bar.height).toBe('249px');
    });
  });

  describe('Horizontal bar with title', () => {
    it('should place above if height > 40', () => {
      const props = getProps({
        height: 41,
        value: getValue(100, 'AA'),
        orientation: VizOrientation.Horizontal,
      });
      const styles = getTitleStyles(props);
      expect(styles.wrapper.flexDirection).toBe('column');
    });
  });

  describe('Horizontal bar with title', () => {
    it('should place below if height < 40', () => {
      const props = getProps({
        height: 30,
        value: getValue(100, 'AA'),
        orientation: VizOrientation.Horizontal,
      });
      const styles = getTitleStyles(props);
      expect(styles.wrapper.flexDirection).toBe('row');
    });
  });

  describe('Gradient', () => {
    it('should build gradient based on thresholds', () => {
      const props = getProps({ orientation: VizOrientation.Vertical, value: getValue(100) });
      const gradient = getBarGradient(props, 300);
      expect(gradient).toBe('linear-gradient(0deg, #73BF69, #73BF69 105px, #FF9830 240px, #F2495C)');
    });

    it('should stop gradient if value < threshold', () => {
      const props = getProps({ orientation: VizOrientation.Vertical, value: getValue(70) });
      const gradient = getBarGradient(props, 300);
      expect(gradient).toBe('linear-gradient(0deg, #73BF69, #73BF69 105px, #FF9830)');
    });
  });

  describe('Render with basic options', () => {
    it('should render', () => {
      const { wrapper } = setup();
      expect(wrapper).toMatchSnapshot();
    });
  });
});
