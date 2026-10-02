import { render } from '@testing-library/react';

import {
  type DisplayValue,
  VizOrientation,
  ThresholdsMode,
  FALLBACK_COLOR,
  type Field,
  FieldType,
  getDisplayProcessor,
  createTheme,
} from '@grafana/data';
import { BarGaugeDisplayMode, BarGaugeNamePlacement, BarGaugeValueMode, ScaleDistribution } from '@grafana/schema';

import {
  BarGauge,
  type Props,
  getTextValueColor,
  getBasicAndGradientStyles,
  getBarGradient,
  getTitleStyles,
  getValuePercent,
  calculateBarAndValueDimensions,
  getCellColor,
} from './BarGauge';

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
  const theme = createTheme();
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
    namePlacement: BarGaugeNamePlacement.Auto,
    isOverflow: false,
  };

  Object.assign(props, propOverrides);
  return props;
}

function getValue(value: number, title?: string): DisplayValue {
  return { numeric: value, text: value.toString(), title: title, color: '#FF0000' };
}

describe('BarGauge', () => {
  describe('getCellColor', () => {
    it('returns a fallback if the positionValue is null', () => {
      const props = getProps();
      expect(getCellColor(null, props.value, props.display)).toEqual({
        background: FALLBACK_COLOR,
        border: FALLBACK_COLOR,
      });
    });

    it('does not show as lit if the value is null (somehow)', () => {
      const props = getProps();
      expect(getCellColor(1, null as unknown as DisplayValue, props.display)).toEqual(
        expect.objectContaining({
          isLit: false,
        })
      );
    });

    it('does not show as lit if the numeric value is NaN', () => {
      const props = getProps();
      expect(
        getCellColor(
          1,
          {
            numeric: NaN,
            text: '0',
          },
          props.display
        )
      ).toEqual(
        expect.objectContaining({
          isLit: false,
        })
      );
    });

    it('does not show as lit if the positionValue is greater than the numeric value', () => {
      const props = getProps();
      expect(getCellColor(75, props.value, props.display)).toEqual(
        expect.objectContaining({
          isLit: false,
        })
      );
    });

    it('shows as lit otherwise', () => {
      const props = getProps();
      expect(getCellColor(1, props.value, props.display)).toEqual(
        expect.objectContaining({
          isLit: true,
        })
      );
    });

    it('returns a fallback if there is no display processor', () => {
      const props = getProps();
      expect(getCellColor(null, props.value, undefined)).toEqual({
        background: FALLBACK_COLOR,
        border: FALLBACK_COLOR,
      });
    });
  });

  describe('Get value color', () => {
    it('should get the threshold color if value is same as a threshold', () => {
      const props = getProps();
      props.value = props.display!(70);
      expect(getTextValueColor(props)).toEqual(orange);
    });
    it('should get the base threshold', () => {
      const props = getProps();
      props.value = props.display!(-10);
      expect(getTextValueColor(props)).toEqual(green);
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

    it('returns 0 if the min, max and value are all the same value', () => {
      expect(getValuePercent(25, 25, 25)).toEqual(0);
    });
  });

  describe('Vertical bar', () => {
    it('should adjust empty region to always have same width as colored bar', () => {
      const props = getProps({
        width: 150,
        value: getValue(100),
        orientation: VizOrientation.Vertical,
      });
      const styles = getBasicAndGradientStyles(props);
      expect(styles.emptyBar.width).toBe('150px');
    });

    it('should keep empty region the same width as colored bar when value is hidden', () => {
      const props = getProps({
        width: 150,
        value: getValue(50, 'ServerA'),
        orientation: VizOrientation.Vertical,
        valueDisplayMode: BarGaugeValueMode.Hidden,
      });
      const styles = getBasicAndGradientStyles(props);
      expect(styles.emptyBar.width).toBe('150px');
      expect(styles.emptyBar.width).toBe(styles.bar.width);
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

    it('should place left even if height > 40 if name placement is set to left', () => {
      const props = getProps({
        height: 41,
        value: getValue(100, 'AA'),
        orientation: VizOrientation.Horizontal,
        namePlacement: BarGaugeNamePlacement.Left,
      });
      const styles = getTitleStyles(props);
      expect(styles.wrapper.flexDirection).toBe('row');
    });

    it('should place above even if height < 40 if name placement is set to top', () => {
      const props = getProps({
        height: 39,
        value: getValue(100, 'AA'),
        orientation: VizOrientation.Horizontal,
        namePlacement: BarGaugeNamePlacement.Top,
      });
      const styles = getTitleStyles(props);
      expect(styles.wrapper.flexDirection).toBe('column');
    });

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

    it('Should limit text length to 40%', () => {
      const props = getProps({
        height: 30,
        value: getValue(
          100,
          'saaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
        ),
        orientation: VizOrientation.Horizontal,
      });
      const styles = getTitleStyles(props);
      expect(styles.title.width).toBe('119px');
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

    it('should adjust empty region to always have same height as colored bar', () => {
      const props = getProps({
        height: 150,
        value: getValue(100),
        orientation: VizOrientation.Horizontal,
      });
      const styles = getBasicAndGradientStyles(props);
      expect(styles.emptyBar.height).toBe('150px');
    });

    it('should keep empty region the same height as colored bar when value is hidden', () => {
      const props = getProps({
        height: 150,
        value: getValue(50, 'ServerA'),
        orientation: VizOrientation.Horizontal,
        valueDisplayMode: BarGaugeValueMode.Hidden,
      });
      const styles = getBasicAndGradientStyles(props);
      expect(styles.emptyBar.height).not.toBe('0px');
      expect(styles.emptyBar.height).toBe(styles.bar.height);
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
      const props = getProps();
      expect(() => render(<BarGauge {...props} />)).not.toThrow();
    });
  });

  describe('calculateBarAndValueDimensions', () => {
    it('valueWidth should including paddings in valueWidth', () => {
      const result = calculateBarAndValueDimensions(
        getProps({
          height: 30,
          width: 100,
          value: getValue(1, 'AA'),
          orientation: VizOrientation.Horizontal,
        })
      );
      expect(result.valueWidth).toBe(21);
    });

    it('valueWidth be zero if valueMode is hideen', () => {
      const result = calculateBarAndValueDimensions(
        getProps({
          height: 30,
          width: 100,
          value: getValue(1, 'AA'),
          orientation: VizOrientation.Horizontal,
          valueDisplayMode: BarGaugeValueMode.Hidden,
        })
      );
      expect(result.valueWidth).toBe(0);
    });
  });

  describe('With valueMode set to text color', () => {
    it('should color value using text color', () => {
      const props = getProps({
        width: 150,
        value: getValue(100),
        orientation: VizOrientation.Vertical,
        valueDisplayMode: BarGaugeValueMode.Text,
      });
      const styles = getBasicAndGradientStyles(props);
      expect(styles.bar.background).toBe('rgb(from #FF0000 r g b / 0.35)');
      expect(styles.value.color).toBe('rgb(204, 204, 220)');
    });
  });

  describe('With valueMode set to text value', () => {
    it('should color value value color', () => {
      const props = getProps({
        width: 150,
        value: getValue(100),
        orientation: VizOrientation.Vertical,
        valueDisplayMode: BarGaugeValueMode.Color,
      });
      const styles = getBasicAndGradientStyles(props);
      expect(styles.bar.background).toBe('rgb(from #FF0000 r g b / 0.35)');
      expect(styles.value.color).toBe('#FF0000');
    });
  });

  describe('log scale', () => {
    function getLogProps(propOverrides?: Partial<Props>): Props {
      const props = getProps(propOverrides);
      props.field = {
        ...props.field,
        min: 1,
        max: 10000,
        custom: { scaleDistribution: { type: ScaleDistribution.Log } },
      };
      return props;
    }

    it('fills half the bar for the geometric midpoint of the range', () => {
      const props = getLogProps({ value: getValue(100), orientation: VizOrientation.Vertical });
      // 270px = 300px height minus the 30px value row
      expect(getBasicAndGradientStyles(props).bar.height).toBe('135px');
    });

    it('positions absolute threshold colors at their log position', () => {
      const props = getLogProps({ value: getValue(10000), orientation: VizOrientation.Vertical });
      props.field.thresholds = {
        mode: ThresholdsMode.Absolute,
        steps: [
          { value: -Infinity, color: 'green' },
          { value: 100, color: 'orange' },
          { value: 1000, color: 'red' },
        ],
      };
      expect(getBarGradient(props, 400)).toBe('linear-gradient(0deg, #73BF69, #73BF69 100px, #FF9830 250px, #F2495C)');
    });

    it('positions percentage threshold colors at the log position of the value they resolve to', () => {
      const props = getLogProps({ value: getValue(10000), orientation: VizOrientation.Vertical });
      // 50% and 90% of 1..10000 resolve to 5000.5 and 9000.1
      props.field.thresholds = {
        mode: ThresholdsMode.Percentage,
        steps: [
          { value: -Infinity, color: 'green' },
          { value: 50, color: 'orange' },
          { value: 90, color: 'red' },
        ],
      };
      expect(getBarGradient(props, 400)).toBe('linear-gradient(0deg, #73BF69, #73BF69 185px, #FF9830 383px, #F2495C)');
    });

    it('samples retro LCD cell colors at log-spaced values', () => {
      const display = jest.fn((value: unknown) => ({ numeric: Number(value), text: String(value), color: green }));
      // 70px height leaves room for 4 cells of 12px
      const props = getLogProps({
        displayMode: BarGaugeDisplayMode.Lcd,
        orientation: VizOrientation.Vertical,
        height: 70,
        value: getValue(150),
        display,
      });
      render(<BarGauge {...props} />);
      expect(display.mock.calls.map(([value]) => value)).toEqual([1, 10, 100, 1000]);
    });
  });
});
