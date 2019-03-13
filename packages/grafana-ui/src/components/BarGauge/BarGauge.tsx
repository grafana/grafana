// Library
import React, { PureComponent, CSSProperties } from 'react';
import tinycolor from 'tinycolor2';

// Utils
import { getColorFromHexRgbOrName, getValueFormat, getThresholdForValue } from '../../utils';

// Types
import { Themeable, TimeSeriesValue, Threshold, ValueMapping, VizOrientation } from '../../types';

const BAR_SIZE_RATIO = 0.8;

export interface Props extends Themeable {
  height: number;
  unit: string;
  width: number;
  thresholds: Threshold[];
  valueMappings: ValueMapping[];
  value: TimeSeriesValue;
  maxValue: number;
  minValue: number;
  orientation: VizOrientation;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}

/*
 * This visualization is still in POC state, needed more tests & better structure
 */
export class BarGauge extends PureComponent<Props> {
  static defaultProps: Partial<Props> = {
    maxValue: 100,
    minValue: 0,
    value: 100,
    unit: 'none',
    orientation: VizOrientation.Horizontal,
    thresholds: [],
    valueMappings: [],
  };

  getNumericValue(): number {
    if (Number.isFinite(this.props.value as number)) {
      return this.props.value as number;
    }
    return 0;
  }

  getValueColors(): BarColors {
    const { thresholds, theme, value } = this.props;

    const activeThreshold = getThresholdForValue(thresholds, value);

    if (activeThreshold !== null) {
      const color = getColorFromHexRgbOrName(activeThreshold.color, theme.type);

      return {
        value: color,
        border: color,
        bar: tinycolor(color)
          .setAlpha(0.3)
          .toRgbString(),
      };
    }

    return {
      value: getColorFromHexRgbOrName('gray', theme.type),
      bar: getColorFromHexRgbOrName('gray', theme.type),
      border: getColorFromHexRgbOrName('gray', theme.type),
    };
  }

  getCellColor(positionValue: TimeSeriesValue): string {
    const { thresholds, theme, value } = this.props;
    const activeThreshold = getThresholdForValue(thresholds, positionValue);

    if (activeThreshold !== null) {
      const color = getColorFromHexRgbOrName(activeThreshold.color, theme.type);

      // if we are past real value the cell is not "on"
      if (value === null || (positionValue !== null && positionValue > value)) {
        return tinycolor(color)
          .setAlpha(0.15)
          .toRgbString();
      } else {
        return tinycolor(color)
          .setAlpha(0.7)
          .toRgbString();
      }
    }

    return 'gray';
  }

  getValueStyles(value: string, color: string, width: number): CSSProperties {
    const guess = width / (value.length * 1.1);
    const fontSize = Math.min(Math.max(guess, 14), 40);

    return {
      color: color,
      fontSize: fontSize + 'px',
    };
  }

  renderVerticalBar(valueFormatted: string, valuePercent: number) {
    const { height, width } = this.props;

    const maxHeight = height * BAR_SIZE_RATIO;
    const barHeight = Math.max(valuePercent * maxHeight, 0);
    const colors = this.getValueColors();
    const valueStyles = this.getValueStyles(valueFormatted, colors.value, width);

    const containerStyles: CSSProperties = {
      width: `${width}px`,
      height: `${height}px`,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
    };

    const barStyles: CSSProperties = {
      height: `${barHeight}px`,
      width: `${width}px`,
      backgroundColor: colors.bar,
      borderTop: `1px solid ${colors.border}`,
    };

    return (
      <div style={containerStyles}>
        <div className="bar-gauge__value" style={valueStyles}>
          {valueFormatted}
        </div>
        <div style={barStyles} />
      </div>
    );
  }

  renderHorizontalBar(valueFormatted: string, valuePercent: number) {
    const { height, width } = this.props;

    const maxWidth = width * BAR_SIZE_RATIO;
    const barWidth = Math.max(valuePercent * maxWidth, 0);
    const colors = this.getValueColors();
    const valueStyles = this.getValueStyles(valueFormatted, colors.value, width * (1 - BAR_SIZE_RATIO));

    valueStyles.marginLeft = '8px';

    const containerStyles: CSSProperties = {
      width: `${width}px`,
      height: `${height}px`,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
    };

    const barStyles = {
      height: `${height}px`,
      width: `${barWidth}px`,
      backgroundColor: colors.bar,
      borderRight: `1px solid ${colors.border}`,
    };

    return (
      <div style={containerStyles}>
        <div style={barStyles} />
        <div className="bar-gauge__value" style={valueStyles}>
          {valueFormatted}
        </div>
      </div>
    );
  }

  renderHorizontalLCD(valueFormatted: string, valuePercent: number) {
    const { height, width, maxValue, minValue } = this.props;

    const valueRange = maxValue - minValue;
    const maxWidth = width * BAR_SIZE_RATIO;
    const cellSpacing = 4;
    const cellCount = 30;
    const cellWidth = (maxWidth - cellSpacing * cellCount) / cellCount;
    const colors = this.getValueColors();
    const valueStyles = this.getValueStyles(valueFormatted, colors.value, width * (1 - BAR_SIZE_RATIO));
    valueStyles.marginLeft = '8px';

    const containerStyles: CSSProperties = {
      width: `${width}px`,
      height: `${height}px`,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
    };

    const cells: JSX.Element[] = [];

    for (let i = 0; i < cellCount; i++) {
      const currentValue = (valueRange / cellCount) * i;
      const cellColor = this.getCellColor(currentValue);
      const cellStyles: CSSProperties = {
        width: `${cellWidth}px`,
        backgroundColor: cellColor,
        marginRight: '4px',
        height: `${height}px`,
        borderRadius: '2px',
      };

      cells.push(<div style={cellStyles} />);
    }

    return (
      <div style={containerStyles}>
        {cells}
        <div className="bar-gauge__value" style={valueStyles}>
          {valueFormatted}
        </div>
      </div>
    );
  }

  render() {
    const { maxValue, minValue, orientation, unit, decimals } = this.props;

    const numericValue = this.getNumericValue();
    const valuePercent = Math.min(numericValue / (maxValue - minValue), 1);

    const formatFunc = getValueFormat(unit);
    const valueFormatted = formatFunc(numericValue, decimals);
    const vertical = orientation === 'vertical';

    return vertical
      ? this.renderVerticalBar(valueFormatted, valuePercent)
      : this.renderHorizontalLCD(valueFormatted, valuePercent);
  }
}

interface BarColors {
  value: string;
  bar: string;
  border: string;
}
