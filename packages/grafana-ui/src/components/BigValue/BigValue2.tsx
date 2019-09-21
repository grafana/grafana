// Library
import React, { PureComponent, CSSProperties } from 'react';
import tinycolor from 'tinycolor2';
import { Chart, Geom } from 'bizcharts';
import { DisplayValue } from '@grafana/data';

// Utils
import { getColorFromHexRgbOrName } from '../../utils';

// Types
import { Themeable } from '../../types';

export interface BigValueSparkline {
  data: any[][];
  minX: number;
  maxX: number;
}

export interface Props extends Themeable {
  height: number;
  width: number;
  value: DisplayValue;
  sparkline?: BigValueSparkline;
  onClick?: React.MouseEventHandler<HTMLElement>;
  className?: string;
}

export class BigValue2 extends PureComponent<Props> {
  render() {
    const { height, width, value, onClick, className, theme, sparkline } = this.props;

    const baseColor = getColorFromHexRgbOrName(value.color || 'green', theme.type);
    const sizes = getSizeCalculations(width, height);
    const panelStyles = getPanelStyles(width, height, baseColor);
    const valueStyles = getValueStyles(sizes);
    const titleStyles = getTitleStyles(sizes);

    return (
      <div className={className} style={panelStyles} onClick={onClick}>
        {value.title && <div style={titleStyles}>{value.title}</div>}
        <div style={valueStyles}>{value.text}</div>
        {sparkline && this.renderChartElement(sizes)}
      </div>
    );
  }

  renderChartElement(sizes: SizeCalculations) {
    const { width, sparkline } = this.props;

    if (!sparkline) {
      return null;
    }

    const data = sparkline.data.map(values => {
      return { time: values[0], value: values[1] };
    });

    const lineStyle: any = {
      stroke: '#EEE',
      lineWidth: 2,
      shadowBlur: 7,
      shadowColor: '#333',
      shadowOffsetY: 7,
    };

    const chartWidth = width - PANEL_PADDING * 2;
    const chartHeight = sizes.chartHeight;
    const scales = {
      time: {
        type: 'time',
      },
    };

    return (
      <Chart
        height={chartHeight}
        width={chartWidth}
        data={data}
        animate={false}
        padding={[0, 0, 0, 0]}
        scale={scales}
        style={{ marginTop: `${CHART_TOP_MARGIN}px` }}
      >
        <Geom type="line" position="time*value" size={2} color="white" style={lineStyle} shape="smooth" />
      </Chart>
    );
  }
}

const MIN_VALUE_FONT_SIZE = 20;
const MAX_VALUE_FONT_SIZE = 40;
const MIN_TITLE_FONT_SIZE = 14;
const TITLE_VALUE_RATIO = 0.5;
const VALUE_HEIGHT_RATIO = 0.3;
const LINE_HEIGHT = 1.2;
const PANEL_PADDING = 16;
const CHART_TOP_MARGIN = 8;

interface SizeCalculations {
  titleFontSize: number;
  valueFontSize: number;
  chartHeight: number;
}

export function getSizeCalculations(width: number, height: number): SizeCalculations {
  const valueFontSize = Math.min(Math.max(height * VALUE_HEIGHT_RATIO, MIN_VALUE_FONT_SIZE), MAX_VALUE_FONT_SIZE);
  const titleFontSize = Math.max(valueFontSize * TITLE_VALUE_RATIO, MIN_TITLE_FONT_SIZE);
  const chartHeight =
    height - valueFontSize * LINE_HEIGHT - titleFontSize * LINE_HEIGHT - PANEL_PADDING * 2 - CHART_TOP_MARGIN;

  return {
    valueFontSize,
    titleFontSize,
    chartHeight,
  };
}

export function getValueFontSize(width: number, height: number): number {
  const byWidth = width * 0.2;

  return Math.min(Math.max(byWidth, MIN_VALUE_FONT_SIZE), MAX_VALUE_FONT_SIZE);
}

export function getTitleStyles(sizes: SizeCalculations) {
  const titleStyles: CSSProperties = {
    fontSize: `${sizes.titleFontSize}px`,
    textShadow: '#333 1px 1px 5px',
    color: '#EEE',
  };

  return titleStyles;
}

export function getValueStyles(sizes: SizeCalculations) {
  const valueStyles: CSSProperties = {
    fontSize: `${sizes.valueFontSize}px`,
    color: 'white',
    textShadow: '#333 1px 1px 5px',
    lineHeight: LINE_HEIGHT,
  };

  return valueStyles;
}

export function getPanelStyles(width: number, height: number, baseColor: string) {
  const bgColor2 = tinycolor(baseColor)
    .darken(15)
    .spin(10)
    .toRgbString();
  const bgColor3 = tinycolor(baseColor)
    .darken(5)
    .spin(-8)
    .toRgbString();

  const panelStyles: CSSProperties = {
    width: `${width}px`,
    height: `${height}px`,
    padding: `${PANEL_PADDING}px`,
    borderRadius: '3px',
    background: `linear-gradient(120deg, ${bgColor2}, ${bgColor3})`,
  };

  return panelStyles;
}
