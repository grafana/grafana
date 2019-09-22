// Library
import React, { PureComponent, CSSProperties } from 'react';
import tinycolor from 'tinycolor2';
import { Chart, Geom } from 'bizcharts';
import { DisplayValue } from '@grafana/data';

// Utils
import { getColorFromHexRgbOrName } from '../../utils';

// Types
import { Themeable, GrafanaTheme } from '../../types';

export interface BigValueSparkline {
  data: any[][];
  minX: number;
  maxX: number;
}

export enum SingleStatDisplayMode {
  Classic,
  ColoredBackground,
  ColoredAreaGraph,
}

export interface Props extends Themeable {
  height: number;
  width: number;
  value: DisplayValue;
  sparkline?: BigValueSparkline;
  onClick?: React.MouseEventHandler<HTMLElement>;
  className?: string;
  displayMode: SingleStatDisplayMode;
}

export class BigValue extends PureComponent<Props> {
  render() {
    const { value, onClick, className, sparkline } = this.props;

    const layout = calculateLayout(this.props);
    const panelStyles = getPanelStyles(layout);
    const valueAndTitleContainerStyles = getValueAndTitleContainerStyles(layout);
    const valueStyles = getValueStyles(layout);
    const titleStyles = getTitleStyles(layout);

    return (
      <div className={className} style={panelStyles} onClick={onClick}>
        <div style={valueAndTitleContainerStyles}>
          {value.title && <div style={titleStyles}>{value.title}</div>}
          <div style={valueStyles}>{value.text}</div>
        </div>
        {renderGraph(layout, sparkline)}
      </div>
    );
  }
}

const MIN_VALUE_FONT_SIZE = 20;
const MAX_VALUE_FONT_SIZE = 50;
const MIN_TITLE_FONT_SIZE = 14;
const TITLE_VALUE_RATIO = 0.5;
const VALUE_HEIGHT_RATIO = 0.2;
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
  displayMode: SingleStatDisplayMode;
  theme: GrafanaTheme;
  valueColor: string;
}

enum LayoutType {
  Stacked,
  StackedNoChart,
  Wide,
  WideNoChart,
}

export function calculateLayout(props: Props): LayoutResult {
  const { width, height, sparkline, displayMode, theme, value } = props;
  const useWideLayout = width / height > 2.2;
  const valueColor = getColorFromHexRgbOrName(value.color || 'green', theme.type);

  // handle wide layouts
  if (useWideLayout) {
    const valueFontSize = Math.min(Math.max(height * VALUE_HEIGHT_RATIO, MIN_VALUE_FONT_SIZE), MAX_VALUE_FONT_SIZE);
    const titleFontSize = Math.max(valueFontSize * TITLE_VALUE_RATIO, MIN_TITLE_FONT_SIZE);

    const chartHeight = height - PANEL_PADDING * 2;
    const chartWidth = width / 2;
    const type = !!sparkline ? LayoutType.Wide : LayoutType.WideNoChart;

    return {
      valueFontSize,
      titleFontSize,
      chartHeight,
      chartWidth,
      type,
      width,
      height,
      displayMode,
      theme,
      valueColor,
    };
  }

  // handle stacked layouts
  const valueFontSize = Math.min(Math.max(height * VALUE_HEIGHT_RATIO, MIN_VALUE_FONT_SIZE), MAX_VALUE_FONT_SIZE);
  const titleFontSize = Math.max(valueFontSize * TITLE_VALUE_RATIO, MIN_TITLE_FONT_SIZE);
  const valueHeight = valueFontSize * LINE_HEIGHT;
  const titleHeight = titleFontSize * LINE_HEIGHT;

  const chartHeight = height - valueHeight - titleHeight - PANEL_PADDING * 2 - CHART_TOP_MARGIN;
  let chartWidth = width - PANEL_PADDING * 2;
  let type = LayoutType.Stacked;

  if (height < 100 || !sparkline) {
    type = LayoutType.StackedNoChart;
  }

  if (displayMode === SingleStatDisplayMode.ColoredAreaGraph) {
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
    displayMode,
    theme,
    valueColor,
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

  switch (layout.displayMode) {
    case SingleStatDisplayMode.Classic:
    case SingleStatDisplayMode.ColoredAreaGraph:
      styles.color = layout.valueColor;
  }

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

export function getPanelStyles(layout: LayoutResult) {
  const panelStyles: CSSProperties = {
    width: `${layout.width}px`,
    height: `${layout.height}px`,
    padding: `${PANEL_PADDING}px`,
    borderRadius: '3px',
    position: 'relative',
    display: 'flex',
  };

  switch (layout.displayMode) {
    case SingleStatDisplayMode.ColoredBackground:
      const bgColor2 = tinycolor(layout.valueColor)
        .darken(15)
        .spin(8)
        .toRgbString();
      const bgColor3 = tinycolor(layout.valueColor)
        .darken(5)
        .spin(-8)
        .toRgbString();

      panelStyles.background = `linear-gradient(120deg, ${bgColor2}, ${bgColor3})`;
      break;
    case SingleStatDisplayMode.ColoredAreaGraph:
      panelStyles.background = `${layout.theme.colors.dark4}`;
      break;
  }

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

function renderGraph(layout: LayoutResult, sparkline?: BigValueSparkline) {
  if (!sparkline) {
    return null;
  }

  const data = sparkline.data.map(values => {
    return { time: values[0], value: values[1], name: 'A' };
  });

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

  switch (layout.displayMode) {
    case SingleStatDisplayMode.ColoredAreaGraph:
      chartStyles.position = 'absolute';
      chartStyles.bottom = 0;
      chartStyles.right = 0;
      chartStyles.left = 0;
      chartStyles.right = 0;
      chartStyles.top = 'unset';
      break;
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
      {layout.displayMode === SingleStatDisplayMode.ColoredAreaGraph && renderAreaGeom(layout)}
      {layout.displayMode !== SingleStatDisplayMode.ColoredAreaGraph && renderLineGeom()}
    </Chart>
  );
}

function renderLineGeom() {
  const lineStyle: any = {
    stroke: '#CCC',
    lineWidth: 2,
    shadowBlur: 15,
    shadowColor: '#444',
    shadowOffsetY: 7,
  };

  return <Geom type="line" position="time*value" size={2} color="white" style={lineStyle} shape="smooth" />;
}

function renderAreaGeom(layout: LayoutResult) {
  const lineStyle: any = {
    opacity: 1,
    fillOpacity: 1,
  };

  const color1 = tinycolor(layout.valueColor)
    .darken(0)
    .spin(20)
    .toRgbString();
  const color2 = tinycolor(layout.valueColor)
    .lighten(0)
    .spin(-20)
    .toRgbString();

  const colorGradient = `l (0) 0:${color1} 1:${color2}`;

  return <Geom type="area" position="time*value" size={0} color={colorGradient} style={lineStyle} shape="smooth" />;
}
