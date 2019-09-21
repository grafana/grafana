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
    const layout = calculateLayout(width, height);
    const panelStyles = getPanelStyles(layout, baseColor);
    const valueAndTitleContainerStyles = getValueAndTitleContainerStyles(layout);
    const valueStyles = getValueStyles(layout);
    const titleStyles = getTitleStyles(layout);

    return (
      <div className={className} style={panelStyles} onClick={onClick}>
        <div style={valueAndTitleContainerStyles}>
          {value.title && <div style={titleStyles}>{value.title}</div>}
          <div style={valueStyles}>{value.text}</div>
        </div>
        {sparkline && this.renderChartElement(layout)}
      </div>
    );
  }

  renderChartElement(layout: LayoutResult) {
    const { sparkline } = this.props;

    if (!sparkline) {
      return null;
    }

    const data = sparkline.data.map(values => {
      return { time: values[0], value: values[1] };
    });

    const lineStyle: any = {
      stroke: '#CCC',
      lineWidth: 2,
      shadowBlur: 7,
      shadowColor: '#333',
      shadowOffsetY: 7,
    };

    const scales = {
      time: {
        type: 'time',
      },
    };

    const chartStyles: CSSProperties = {
      marginTop: `${CHART_TOP_MARGIN}`,
    };

    if (layout.type === LayoutType.ChartRight) {
      chartStyles.position = 'absolute';
      chartStyles.bottom = 0;
      chartStyles.left = 0;
      chartStyles.width = `${layout.chartHeight}px`;
      chartStyles.height = `${layout.chartHeight}px`;
    }

    return (
      <Chart
        height={layout.chartHeight}
        width={layout.chartWidth}
        data={data}
        animate={false}
        padding={[0, 0, 0, 0]}
        scale={scales}
        style={chartStyles}
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

interface LayoutResult {
  titleFontSize: number;
  valueFontSize: number;
  chartHeight: number;
  chartWidth: number;
  type: LayoutType;
  width: number;
  height: number;
}

enum LayoutType {
  ChartBelow,
  ChartRight,
}

export function calculateLayout(width: number, height: number): LayoutResult {
  let type = LayoutType.ChartBelow;

  const valueFontSize = Math.min(Math.max(height * VALUE_HEIGHT_RATIO, MIN_VALUE_FONT_SIZE), MAX_VALUE_FONT_SIZE);
  const titleFontSize = Math.max(valueFontSize * TITLE_VALUE_RATIO, MIN_TITLE_FONT_SIZE);
  let chartHeight =
    height - valueFontSize * LINE_HEIGHT - titleFontSize * LINE_HEIGHT - PANEL_PADDING * 2 - CHART_TOP_MARGIN;
  let chartWidth = width - PANEL_PADDING * 2;

  if (width / height > 2.2) {
    type = LayoutType.ChartRight;
    chartHeight = height - PANEL_PADDING * 2;
    chartWidth = width;
  }

  return {
    valueFontSize,
    titleFontSize,
    chartHeight,
    chartWidth,
    type,
    width,
    height,
  };
}

export function getTitleStyles(layout: LayoutResult) {
  const styles: CSSProperties = {
    fontSize: `${layout.titleFontSize}px`,
    textShadow: '#333 1px 1px 5px',
    color: '#EEE',
  };

  return styles;
}

export function getValueStyles(layout: LayoutResult) {
  const styles: CSSProperties = {
    fontSize: `${layout.valueFontSize}px`,
    color: '#EEE',
    textShadow: '#333 1px 1px 5px',
    lineHeight: LINE_HEIGHT,
  };

  return styles;
}

export function getValueAndTitleContainerStyles(layout: LayoutResult) {
  const styles: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    justifyContent: 'center',
  };

  if (layout.type === LayoutType.ChartRight) {
    styles.flexDirection = 'row';
    styles.justifyContent = 'space-between';
    styles.alignItems = 'center';
  }

  return styles;
}

export function getPanelStyles(layout: LayoutResult, baseColor: string) {
  const bgColor2 = tinycolor(baseColor)
    .darken(15)
    .spin(8)
    .toRgbString();
  const bgColor3 = tinycolor(baseColor)
    .darken(5)
    .spin(-8)
    .toRgbString();

  const panelStyles: CSSProperties = {
    width: `${layout.width}px`,
    height: `${layout.height}px`,
    padding: `${PANEL_PADDING}px`,
    borderRadius: '3px',
    background: `linear-gradient(120deg, ${bgColor2}, ${bgColor3})`,
    position: 'relative',
  };

  if (layout.type === LayoutType.ChartRight) {
    panelStyles.display = 'flex';
    panelStyles.alignItems = 'center';
  }

  return panelStyles;
}
