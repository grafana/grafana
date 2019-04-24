// Library
import React, { PureComponent, CSSProperties, ReactNode } from 'react';
import tinycolor from 'tinycolor2';

// Utils
import { getColorFromHexRgbOrName, getThresholdForValue } from '../../utils';

// Types
import { DisplayValue, Themeable, TimeSeriesValue, Threshold, VizOrientation } from '../../types';

const MIN_VALUE_HEIGHT = 18;
const MAX_VALUE_HEIGHT = 50;
const MIN_VALUE_WIDTH = 50;
const MAX_VALUE_WIDTH = 100;
const LINE_HEIGHT = 1.5;

export interface Props extends Themeable {
  height: number;
  width: number;
  thresholds: Threshold[];
  value: DisplayValue;
  maxValue: number;
  minValue: number;
  orientation: VizOrientation;
  itemSpacing?: number;
  displayMode: 'basic' | 'lcd' | 'gradient';
}

export class BarGauge extends PureComponent<Props> {
  static defaultProps: Partial<Props> = {
    maxValue: 100,
    minValue: 0,
    value: {
      text: '100',
      numeric: 100,
    },
    displayMode: 'lcd',
    orientation: VizOrientation.Horizontal,
    thresholds: [],
    itemSpacing: 10,
  };

  render() {
    const { title } = this.props.value;

    if (!title) {
      return this.renderBarAndValue();
    }

    const styles = getTitleStyles(this.props);

    return (
      <div style={styles.wrapper}>
        <div style={styles.title}>{title}</div>
        {this.renderBarAndValue()}
      </div>
    );
  }

  renderBarAndValue() {
    switch (this.props.displayMode) {
      case 'lcd':
        return this.renderRetroBars();
      case 'basic':
      case 'gradient':
      default:
        return this.renderBasicAndGradientBars();
    }
  }

  renderBasicAndGradientBars(): ReactNode {
    const { value } = this.props;

    const styles = getBasicAndGradientStyles(this.props);

    return (
      <div style={styles.wrapper}>
        <div className="bar-gauge__value" style={styles.value}>
          {value.text}
        </div>
        <div style={styles.bar} />
      </div>
    );
  }

  getCellColor(positionValue: TimeSeriesValue): CellColors {
    const { thresholds, theme, value } = this.props;
    const activeThreshold = getThresholdForValue(thresholds, positionValue);

    if (activeThreshold !== null) {
      const color = getColorFromHexRgbOrName(activeThreshold.color, theme.type);

      // if we are past real value the cell is not "on"
      if (value === null || (positionValue !== null && positionValue > value.numeric)) {
        return {
          background: tinycolor(color)
            .setAlpha(0.18)
            .toRgbString(),
          border: 'transparent',
          isLit: false,
        };
      } else {
        return {
          background: tinycolor(color)
            .setAlpha(0.95)
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

  renderRetroBars(): ReactNode {
    const { maxValue, minValue, value, itemSpacing } = this.props;
    const {
      valueHeight,
      valueWidth,
      maxBarHeight,
      maxBarWidth,
      wrapperWidth,
      wrapperHeight,
    } = calculateBarAndValueDimensions(this.props);

    const isVert = isVertical(this.props);
    const valueRange = maxValue - minValue;
    const maxSize = isVert ? maxBarHeight : maxBarWidth;
    const cellSpacing = itemSpacing!;
    const cellWidth = 12;
    const cellCount = Math.floor(maxSize / cellWidth);
    const cellSize = Math.floor((maxSize - cellSpacing * cellCount) / cellCount);
    const valueColor = getValueColor(this.props);
    const valueStyles = getValueStyles(value.text, valueColor, valueWidth, valueHeight);

    const containerStyles: CSSProperties = {
      width: `${wrapperWidth}px`,
      height: `${wrapperHeight}px`,
      display: 'flex',
    };

    if (isVert) {
      containerStyles.flexDirection = 'column-reverse';
      containerStyles.alignItems = 'center';
      valueStyles.justifyContent = 'center';
    } else {
      containerStyles.flexDirection = 'row';
      containerStyles.alignItems = 'center';
      valueStyles.justifyContent = 'flex-end';
    }

    const cells: JSX.Element[] = [];

    for (let i = 0; i < cellCount; i++) {
      const currentValue = (valueRange / cellCount) * i;
      const cellColor = this.getCellColor(currentValue);
      const cellStyles: CSSProperties = {
        borderRadius: '2px',
      };

      if (cellColor.isLit) {
        cellStyles.backgroundImage = `radial-gradient(${cellColor.background} 10%, ${cellColor.backgroundShade})`;
      } else {
        cellStyles.backgroundColor = cellColor.background;
      }

      if (isVert) {
        cellStyles.height = `${cellSize}px`;
        cellStyles.width = `${maxBarWidth}px`;
        cellStyles.marginTop = `${cellSpacing}px`;
      } else {
        cellStyles.width = `${cellSize}px`;
        cellStyles.height = `${maxBarHeight}px`;
        cellStyles.marginRight = `${cellSpacing}px`;
      }

      cells.push(<div key={i.toString()} style={cellStyles} />);
    }

    return (
      <div style={containerStyles}>
        {cells}
        <div className="bar-gauge__value" style={valueStyles}>
          {value.text}
        </div>
      </div>
    );
  }
}

interface CellColors {
  background: string;
  backgroundShade?: string;
  border: string;
  isLit?: boolean;
}

interface TitleDimensions {
  fontSize: number;
  placement: 'above' | 'left' | 'below';
  width: number;
  height: number;
}

function isVertical(props: Props) {
  return props.orientation === VizOrientation.Vertical;
}

function calculateTitleDimensions(props: Props): TitleDimensions {
  const { title } = props.value;
  const { height, width } = props;

  if (!title) {
    return { fontSize: 0, width: 0, height: 0, placement: 'above' };
  }

  if (isVertical(props)) {
    return {
      fontSize: 14,
      width: width,
      height: 14 * LINE_HEIGHT,
      placement: 'below',
    };
  }

  // if height above 40 put text to above bar
  if (height > 40) {
    const maxTitleHeightRatio = 0.35;
    const titleHeight = Math.max(Math.min(height * maxTitleHeightRatio, MAX_VALUE_HEIGHT), 17);

    return {
      fontSize: titleHeight / LINE_HEIGHT,
      width: 0,
      height: titleHeight,
      placement: 'above',
    };
  }

  // title to left of bar scenario
  const maxTitleHeightRatio = 0.6;
  const maxTitleWidthRatio = 0.2;
  const titleHeight = Math.max(height * maxTitleHeightRatio, MIN_VALUE_HEIGHT);

  return {
    fontSize: titleHeight / LINE_HEIGHT,
    height: 0,
    width: Math.min(Math.max(width * maxTitleWidthRatio, 50), 200),
    placement: 'left',
  };
}

export function getTitleStyles(props: Props): { wrapper: CSSProperties; title: CSSProperties } {
  const wrapperStyles: CSSProperties = {
    display: 'flex',
    overflow: 'hidden',
  };

  const titleDim = calculateTitleDimensions(props);

  const titleStyles: CSSProperties = {
    fontSize: `${titleDim.fontSize}px`,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    width: '100%',
    alignItems: 'center',
    alignSelf: 'center',
  };

  if (isVertical(props)) {
    wrapperStyles.flexDirection = 'column-reverse';
    titleStyles.textAlign = 'center';
  } else {
    if (titleDim.placement === 'above') {
      wrapperStyles.flexDirection = 'column';
    } else {
      wrapperStyles.flexDirection = 'row';

      titleStyles.width = `${titleDim.width}px`;
      titleStyles.textAlign = 'right';
      titleStyles.paddingRight = '10px';
    }
  }

  return {
    wrapper: wrapperStyles,
    title: titleStyles,
  };
}

interface BasicAndGradientStyles {
  wrapper: CSSProperties;
  bar: CSSProperties;
  value: CSSProperties;
}

interface BarAndValueDimensions {
  valueWidth: number;
  valueHeight: number;
  maxBarWidth: number;
  maxBarHeight: number;
  wrapperHeight: number;
  wrapperWidth: number;
}

function calculateBarAndValueDimensions(props: Props): BarAndValueDimensions {
  const { height, width } = props;
  const titleDim = calculateTitleDimensions(props);

  let maxBarHeight = 0;
  let maxBarWidth = 0;
  let valueHeight = 0;
  let valueWidth = 0;
  let wrapperWidth = 0;
  let wrapperHeight = 0;

  if (isVertical(props)) {
    valueHeight = Math.min(Math.max(height * 0.1, MIN_VALUE_HEIGHT), MAX_VALUE_HEIGHT);
    valueWidth = width;
    maxBarHeight = height - (titleDim.height + valueHeight);
    maxBarWidth = width;
    wrapperWidth = width;
    wrapperHeight = height - titleDim.height;
  } else {
    valueHeight = height - titleDim.height;
    valueWidth = Math.max(Math.min(width * 0.2, MAX_VALUE_WIDTH), MIN_VALUE_WIDTH);
    maxBarHeight = height - titleDim.height;
    maxBarWidth = width - valueWidth - titleDim.width;

    if (titleDim.placement === 'above') {
      wrapperWidth = width;
      wrapperHeight = height - titleDim.height;
    } else {
      wrapperWidth = width - titleDim.width;
      wrapperHeight = height;
    }
  }

  // console.log('titleDim', titleDim);
  // console.log('valueWidth', valueWidth);
  // console.log('width', width);
  // console.log('total', titleDim.width + maxBarWidth + valueWidth);

  return {
    valueWidth,
    valueHeight,
    maxBarWidth,
    maxBarHeight,
    wrapperHeight,
    wrapperWidth,
  };
}

/**
 * Only exported to for unit test
 */
export function getBasicAndGradientStyles(props: Props): BasicAndGradientStyles {
  const { displayMode, maxValue, minValue, value } = props;
  const { valueWidth, valueHeight, maxBarHeight, maxBarWidth } = calculateBarAndValueDimensions(props);

  const valuePercent = Math.min(value.numeric / (maxValue - minValue), 1);
  const valueColor = getValueColor(props);
  const valueStyles = getValueStyles(value.text, valueColor, valueWidth, valueHeight);
  const isBasic = displayMode === 'basic';

  const wrapperStyles: CSSProperties = {
    display: 'flex',
  };

  const barStyles: CSSProperties = {
    borderRadius: '3px',
  };

  if (isVertical(props)) {
    const barHeight = Math.max(valuePercent * maxBarHeight, 1);

    // vertical styles
    wrapperStyles.flexDirection = 'column';
    wrapperStyles.justifyContent = 'flex-end';

    barStyles.transition = 'height 1s';
    barStyles.height = `${barHeight}px`;
    barStyles.width = `${maxBarWidth}px`;

    // value styles centered
    valueStyles.justifyContent = 'center';

    if (isBasic) {
      // Basic styles
      barStyles.background = `${tinycolor(valueColor)
        .setAlpha(0.25)
        .toRgbString()}`;
      barStyles.borderTop = `2px solid ${valueColor}`;
    } else {
      // Gradient styles
      barStyles.background = getBarGradient(props, maxBarHeight);
    }
  } else {
    const barWidth = Math.max(valuePercent * maxBarWidth, 1);

    // Custom styles for horizontal orientation
    wrapperStyles.flexDirection = 'row-reverse';
    wrapperStyles.justifyContent = 'flex-end';
    wrapperStyles.alignItems = 'center';

    barStyles.transition = 'width 1s';
    barStyles.height = `${maxBarHeight}px`;
    barStyles.width = `${barWidth}px`;

    valueStyles.paddingLeft = '10px';

    if (isBasic) {
      // Basic styles
      barStyles.background = `${tinycolor(valueColor)
        .setAlpha(0.25)
        .toRgbString()}`;
      barStyles.borderRight = `2px solid ${valueColor}`;
    } else {
      // Gradient styles
      barStyles.background = getBarGradient(props, maxBarWidth);
    }
  }

  return {
    wrapper: wrapperStyles,
    bar: barStyles,
    value: valueStyles,
  };
}

/**
 * Only exported to for unit test
 */
export function getBarGradient(props: Props, maxSize: number): string {
  const { minValue, maxValue, thresholds, value } = props;
  const cssDirection = isVertical(props) ? '0deg' : '90deg';

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
    } else if (value.numeric < threshold.value) {
      break;
    } else {
      lastpos = pos;
      gradient += ` ${offset}px, ${color}`;
    }
  }

  return gradient + ')';
}

/**
 * Only exported to for unit test
 */
export function getValueColor(props: Props): string {
  const { thresholds, theme, value } = props;

  const activeThreshold = getThresholdForValue(thresholds, value.numeric);

  if (activeThreshold !== null) {
    return getColorFromHexRgbOrName(activeThreshold.color, theme.type);
  }

  return getColorFromHexRgbOrName('gray', theme.type);
}

/**
 * Only exported to for unit test
 */
function getValueStyles(value: string, color: string, width: number, height: number): CSSProperties {
  const heightFont = height / LINE_HEIGHT;
  const guess = width / (value.length * 1.1);
  const fontSize = Math.min(Math.max(guess, 14), heightFont);

  return {
    color: color,
    height: `${height}px`,
    width: `${width}px`,
    display: 'flex',
    alignItems: 'center',
    fontSize: fontSize.toFixed(2) + 'px',
  };
}

// let canvasElement: HTMLCanvasElement | null = null;
//
// interface TextDimensions {
//   width: number;
//   height: number;
// }
//
// /**
//  * Uses canvas.measureText to compute and return the width of the given text of given font in pixels.
//  *
//  * @param {String} text The text to be rendered.
//  * @param {String} font The css font descriptor that text is to be rendered with (e.g. "bold 14px verdana").
//  *
//  * @see https://stackoverflow.com/questions/118241/calculate-text-width-with-javascript/21015393#21015393
//  */
// function getTextWidth(text: string): number {
//   // re-use canvas object for better performance
//   canvasElement = canvasElement || document.createElement('canvas');
//   const context = canvasElement.getContext('2d');
//   if (context) {
//     context.font = 'normal 16px Roboto';
//     const metrics = context.measureText(text);
//     return metrics.width;
//   }
//   return 16;
// }
