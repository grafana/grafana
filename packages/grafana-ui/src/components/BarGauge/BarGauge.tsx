// Library
import React, { PureComponent, CSSProperties, ReactNode } from 'react';
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
  displayMode: 'basic' | 'lcd' | 'gradient';
}

export class BarGauge extends PureComponent<Props> {
  static defaultProps: Partial<Props> = {
    maxValue: 100,
    minValue: 0,
    value: 100,
    unit: 'none',
    displayMode: 'basic',
    orientation: VizOrientation.Horizontal,
    thresholds: [],
    valueMappings: [],
  };

  render() {
    const { maxValue, minValue, unit, decimals, displayMode } = this.props;

    const numericValue = this.getNumericValue();
    const valuePercent = Math.min(numericValue / (maxValue - minValue), 1);

    const formatFunc = getValueFormat(unit);
    const valueFormatted = formatFunc(numericValue, decimals);

    switch (displayMode) {
      case 'lcd':
        return this.renderRetroBars(valueFormatted, valuePercent);
      case 'basic':
      case 'gradient':
      default:
        return this.renderBasicAndGradientBars(valueFormatted, valuePercent);
    }
  }

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
        background: tinycolor(color)
          .setAlpha(0.15)
          .toRgbString(),
      };
    }

    return {
      value: getColorFromHexRgbOrName('gray', theme.type),
      background: getColorFromHexRgbOrName('gray', theme.type),
      border: getColorFromHexRgbOrName('gray', theme.type),
    };
  }

  getValueStyles(value: string, color: string, width: number): CSSProperties {
    const guess = width / (value.length * 1.1);
    const fontSize = Math.min(Math.max(guess, 14), 40);

    return {
      color: color,
      fontSize: fontSize + 'px',
    };
  }

  /*
   * Return width or height depending on viz orientation
   * */
  get size() {
    const { height, width } = this.props;
    return this.isVertical ? height : width;
  }

  get isVertical() {
    return this.props.orientation === VizOrientation.Vertical;
  }

  getBarGradient(maxSize: number): string {
    const { minValue, maxValue, thresholds } = this.props;
    const cssDirection = this.isVertical ? '0deg' : '90deg';
    const currentValue = this.getNumericValue();

    let gradient = '';
    let lastpos = 0;

    for (let i = 0; i < thresholds.length; i++) {
      const threshold = thresholds[i];
      const color = getColorFromHexRgbOrName(threshold.color);
      const valuePercent = Math.min(threshold.value / (maxValue - minValue), 1);
      const pos = valuePercent * maxSize;
      const offset = Math.round(pos - (pos - lastpos) / 2);

      if (gradient === '') {
        gradient = `linear-gradient(${cssDirection}, ${color}, ${color}`;
      } else if (currentValue < threshold.value) {
        break;
      } else {
        lastpos = pos;
        gradient += ` ${offset}px, ${color}`;
      }
    }

    console.log(gradient);
    return gradient + ')';
  }

  renderBasicAndGradientBars(valueFormatted: string, valuePercent: number): ReactNode {
    const { height, width, displayMode } = this.props;

    const maxSize = this.size * BAR_SIZE_RATIO;
    const barSize = Math.max(valuePercent * maxSize, 0);
    const colors = this.getValueColors();
    const spaceForText = this.isVertical ? width : Math.min(this.size - maxSize, height);
    const valueStyles = this.getValueStyles(valueFormatted, colors.value, spaceForText);
    const isBasic = displayMode === 'basic';

    const containerStyles: CSSProperties = {
      width: `${width}px`,
      height: `${height}px`,
      display: 'flex',
    };

    const barStyles: CSSProperties = {
      borderRadius: '3px',
    };

    if (this.isVertical) {
      // Custom styles for vertical orientation
      containerStyles.flexDirection = 'column';
      containerStyles.justifyContent = 'flex-end';
      barStyles.transition = 'height 1s';
      barStyles.height = `${barSize}px`;
      barStyles.width = `${width}px`;
      if (isBasic) {
        // Basic styles
        barStyles.background = `${colors.background}`;
        barStyles.border = `1px solid ${colors.border}`;
        barStyles.boxShadow = `0 0 4px ${colors.border}`;
      } else {
        // Gradient styles
        barStyles.background = this.getBarGradient(maxSize);
      }
    } else {
      // Custom styles for horizontal orientation
      containerStyles.flexDirection = 'row-reverse';
      containerStyles.justifyContent = 'flex-end';
      containerStyles.alignItems = 'center';
      barStyles.transition = 'width 1s';
      barStyles.height = `${height}px`;
      barStyles.width = `${barSize}px`;
      barStyles.marginRight = '10px';

      if (isBasic) {
        // Basic styles
        barStyles.background = `${colors.background}`;
        barStyles.border = `1px solid ${colors.border}`;
        barStyles.boxShadow = `0 0 4px ${colors.border}`;
      } else {
        // Gradient styles
        barStyles.background = this.getBarGradient(maxSize);
      }
    }

    return (
      <div style={containerStyles}>
        <div className="bar-gauge__value" style={valueStyles}>
          {valueFormatted}
        </div>
        <div style={barStyles} />
      </div>
    );
  }

  getCellColor(positionValue: TimeSeriesValue): CellColors {
    const { thresholds, theme, value } = this.props;
    const activeThreshold = getThresholdForValue(thresholds, positionValue);

    if (activeThreshold !== null) {
      const color = getColorFromHexRgbOrName(activeThreshold.color, theme.type);

      // if we are past real value the cell is not "on"
      if (value === null || (positionValue !== null && positionValue > value)) {
        return {
          background: tinycolor(color)
            .setAlpha(0.15)
            .toRgbString(),
          border: 'transparent',
          isLit: false,
        };
      } else {
        return {
          background: tinycolor(color)
            .setAlpha(0.85)
            .toRgbString(),
          backgroundShade: tinycolor(color)
            .setAlpha(0.55)
            .toRgbString(),
          border: tinycolor(color)
            .setAlpha(0.9)
            .toRgbString(),
          isLit: true,
        };
      }
    }

    return {
      background: 'gray',
      border: 'gray',
    };
  }

  renderRetroBars(valueFormatted: string, valuePercent: number): ReactNode {
    const { height, width, maxValue, minValue } = this.props;

    const valueRange = maxValue - minValue;
    const maxSize = this.size * BAR_SIZE_RATIO;
    const cellSpacing = 5;
    const cellCount = maxSize / 20;
    const cellSize = (maxSize - cellSpacing * cellCount) / cellCount;
    const colors = this.getValueColors();
    const spaceForText = this.isVertical ? width : Math.min(this.size - maxSize, height);
    const valueStyles = this.getValueStyles(valueFormatted, colors.value, spaceForText);

    const containerStyles: CSSProperties = {
      width: `${width}px`,
      height: `${height}px`,
      display: 'flex',
    };

    if (this.isVertical) {
      containerStyles.flexDirection = 'column-reverse';
      containerStyles.alignItems = 'center';
      valueStyles.marginBottom = '20px';
    } else {
      containerStyles.flexDirection = 'row';
      containerStyles.alignItems = 'center';
      valueStyles.marginLeft = '20px';
    }

    const cells: JSX.Element[] = [];

    for (let i = 0; i < cellCount; i++) {
      const currentValue = (valueRange / cellCount) * i;
      const cellColor = this.getCellColor(currentValue);
      const cellStyles: CSSProperties = {
        borderRadius: '2px',
      };

      if (cellColor.isLit) {
        cellStyles.boxShadow = `0 0 4px ${cellColor.border}`;
        cellStyles.backgroundImage = `radial-gradient(${cellColor.background} 10%, ${cellColor.backgroundShade})`;
      } else {
        cellStyles.backgroundColor = cellColor.background;
      }

      if (this.isVertical) {
        cellStyles.height = `${cellSize}px`;
        cellStyles.width = `${width}px`;
        cellStyles.marginTop = `${cellSpacing}px`;
      } else {
        cellStyles.width = `${cellSize}px`;
        cellStyles.height = `${height}px`;
        cellStyles.marginRight = `${cellSpacing}px`;
      }

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
}

interface BarColors {
  value: string;
  background: string;
  border: string;
}

interface CellColors {
  background: string;
  backgroundShade?: string;
  border: string;
  isLit?: boolean;
}
