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
    const layout = calculateLayout(width, height, !!sparkline);
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
      shadowBlur: 15,
      shadowColor: '#444',
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

    switch (layout.type) {
      case LayoutType.Wide:
        chartStyles.width = `${layout.chartWidth}px`;
        chartStyles.height = `${layout.chartHeight}px`;
        break;
      case LayoutType.Stacked:
        chartStyles.position = 'relative';
        chartStyles.top = '8px';
        break;
      case LayoutType.WideNoChart:
      case LayoutType.StackedNoChart:
        return null;
    }

    return (
      <Chart
        height={layout.chartHeight}
        width={layout.chartWidth}
        data={data}
        animate={false}
        padding={[4, 0, 4, 0]}
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
  Stacked,
  StackedNoChart,
  Wide,
  WideNoChart,
}

export function calculateLayout(width: number, height: number, hasSparkLine: boolean): LayoutResult {
  const useWideLayout = width / height > 2.2;

  // handle wide layouts
  if (useWideLayout) {
    const valueFontSize = Math.min(Math.max(height * VALUE_HEIGHT_RATIO, MIN_VALUE_FONT_SIZE), MAX_VALUE_FONT_SIZE);
    const titleFontSize = Math.max(valueFontSize * TITLE_VALUE_RATIO, MIN_TITLE_FONT_SIZE);

    const chartHeight = height - PANEL_PADDING * 2;
    const chartWidth = width / 2;
    const type = hasSparkLine ? LayoutType.Wide : LayoutType.WideNoChart;

    return {
      valueFontSize,
      titleFontSize,
      chartHeight,
      chartWidth,
      type,
      width,
      height,
    };
  } else {
    // handle stacked layouts
    const valueFontSize = Math.min(Math.max(height * VALUE_HEIGHT_RATIO, MIN_VALUE_FONT_SIZE), MAX_VALUE_FONT_SIZE);
    const titleFontSize = Math.max(valueFontSize * TITLE_VALUE_RATIO, MIN_TITLE_FONT_SIZE);
    const valueHeight = valueFontSize * LINE_HEIGHT;
    const titleHeight = titleFontSize * LINE_HEIGHT;

    const chartHeight = height - valueHeight - titleHeight - PANEL_PADDING * 2 - CHART_TOP_MARGIN;
    const chartWidth = width - PANEL_PADDING * 2;
    let type = LayoutType.Stacked;

    if (height < 100 || !hasSparkLine) {
      type = LayoutType.StackedNoChart;
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

export function getValueAndTitleContainerStyles(layout: LayoutResult): CSSProperties {
  switch (layout.type) {
    case LayoutType.Wide:
      return {
        display: 'flex',
        flexDirection: 'column',
        flexGrow: 1,
      };
    case LayoutType.WideNoChart:
      return {
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexGrow: 1,
      };
    case LayoutType.StackedNoChart:
      return {
        display: 'flex',
        flexDirection: 'column',
        flexGrow: 1,
      };
    case LayoutType.Stacked:
    default:
      return {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      };
  }
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
    display: 'flex',
  };

  switch (layout.type) {
    case LayoutType.Stacked:
      panelStyles.flexDirection = 'column';
      break;
    case LayoutType.StackedNoChart:
      panelStyles.alignItems = 'center';
      break;
    case LayoutType.Wide:
      panelStyles.flexDirection = 'row';
      panelStyles.alignItems = 'center';
      panelStyles.justifyContent = 'space-between';
      break;
    case LayoutType.WideNoChart:
      panelStyles.alignItems = 'center';
      break;
  }

  return panelStyles;
}
