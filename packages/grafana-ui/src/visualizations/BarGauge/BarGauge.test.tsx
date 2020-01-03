import React from 'react';
import { shallow } from 'enzyme';
import { DisplayValue, VizOrientation, ThresholdsMode, Field, FieldType, getDisplayProcessor } from '@grafana/data';
import {
  BarGauge,
  Props,
  getValueColor,
  getBasicAndGradientStyles,
  getBarGradient,
  getTitleStyles,
  getValuePercent,
  BarGaugeDisplayMode,
} from './BarGauge';
import { getTheme } from '../../themes';

const green = '#73BF69';
const orange = '#FF9830';

function getProps(propOverrides?: Partial<Props>): Props {
  const field: Partial<Field> = {
    type: FieldType.number,
    config: {
      min: 0,
      max: 100,
      thresholds: {
        mode: ThresholdsMode.Absolute,
        steps: [
          { value: -Infinity, color: 'green' },
          { value: 70, color: 'orange' },
          { value: 90, color: 'red' },
        ],
      },
    },
  };
  const theme = getTheme();
  field.display = getDisplayProcessor({ field, theme });

  const props: Props = {
    displayMode: BarGaugeDisplayMode.Basic,
    field: field.config!,
    display: field.display!,
    height: 300,
    width: 300,
    value: field.display(25),
    theme,
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
      const props = getProps();
      props.value = props.display(70);
      expect(getValueColor(props)).toEqual(orange);
    });
    it('should get the base threshold', () => {
      const props = getProps();
      props.value = props.display(-10);
      expect(getValueColor(props)).toEqual(green);
    });
  });

  describe('Get value percent', () => {
    it('0 to 100 and value 40', () => {
      expect(getValuePercent(40, 0, 100)).toEqual(0.4);
    });

    it('50 to 100 and value 75', () => {
      expect(getValuePercent(75, 50, 100)).toEqual(0.5);
    });

    it('-30 to 30 and value 0', () => {
      expect(getValuePercent(0, -30, 30)).toEqual(0.5);
    });

    it('-30 to 30 and value 30', () => {
      expect(getValuePercent(30, -30, 30)).toEqual(1);
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
      expect(styles.emptyBar.bottom).toBe('-3px');
    });
  });

  describe('Horizontal bar', () => {
    it('should stretch items', () => {
      const props = getProps({
        height: 300,
        value: getValue(100, 'ServerA'),
        orientation: VizOrientation.Horizontal,
      });
      const styles = getBasicAndGradientStyles(props);
      expect(styles.wrapper.alignItems).toBe('stretch');
      expect(styles.emptyBar.left).toBe('-3px');
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

    it('should calculate title width based on title', () => {
      const props = getProps({
        height: 30,
        value: getValue(100, 'AA'),
        orientation: VizOrientation.Horizontal,
      });
      const styles = getTitleStyles(props);
      expect(styles.title.width).toBe('17px');

      const props2 = getProps({
        height: 30,
        value: getValue(120, 'Longer title with many words'),
        orientation: VizOrientation.Horizontal,
      });
      const styles2 = getTitleStyles(props2);
      expect(styles2.title.width).toBe('43px');
    });

    it('should use alignmentFactors if provided', () => {
      const props = getProps({
        height: 30,
        value: getValue(100, 'AA'),
        alignmentFactors: {
          title: 'Super duper long title',
          text: '1000',
        },
        orientation: VizOrientation.Horizontal,
      });
      const styles = getTitleStyles(props);
      expect(styles.title.width).toBe('37px');
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
