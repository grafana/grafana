// Library
import React, { PureComponent, CSSProperties } from 'react';
import tinycolor from 'tinycolor2';
import { Chart, Geom } from 'bizcharts';
import { DisplayValue, GraphSeriesValue } from '@grafana/data';

// Utils
import { getColorFromHexRgbOrName, GrafanaTheme } from '@grafana/data';

// Types
import { Themeable } from '../../types';

export interface BigValueSparkline {
  data: GraphSeriesValue[][];
  minX: number;
  maxX: number;
}

export enum BigValueColorMode {
  Value = 0,
  Background = 2,
}

export enum BigValueGraphMode {
  None = 0,
  Line = 1,
  LineWithFill = 2,
}

export enum BigValueJustifyMode {
  Auto = 0,
  Center = 1,
}

export interface Props extends Themeable {
  height: number;
  width: number;
  value: DisplayValue;
  sparkline?: BigValueSparkline;
  onClick?: React.MouseEventHandler<HTMLElement>;
  className?: string;
  colorMode: BigValueColorMode;
  graphMode: BigValueGraphMode;
  justifyMode?: BigValueJustifyMode;
}

export class BigValue extends PureComponent<Props> {
  static defaultProps: Partial<Props> = {
    justifyMode: BigValueJustifyMode.Auto,
  };

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
const TITLE_VALUE_RATIO = 0.45;
const VALUE_HEIGHT_RATIO = 0.25;
const VALUE_HEIGHT_RATIO_WIDE = 0.3;
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
  colorMode: BigValueColorMode;
  graphMode: BigValueGraphMode;
  theme: GrafanaTheme;
  valueColor: string;
  justifyCenter: boolean;
}

enum LayoutType {
  Stacked,
  StackedNoChart,
  Wide,
  WideNoChart,
}

export function calculateLayout(props: Props): LayoutResult {
  const { width, height, sparkline, colorMode, theme, value, graphMode, justifyMode } = props;
  const useWideLayout = width / height > 2.8;
  const valueColor = getColorFromHexRgbOrName(value.color || 'green', theme.type);
  let justifyCenter = false;

  if (justifyMode === BigValueJustifyMode.Center) {
    justifyCenter = true;
  }

  // handle wide layouts
  if (useWideLayout) {
    const valueFontSize = Math.min(
      Math.max(height * VALUE_HEIGHT_RATIO_WIDE, MIN_VALUE_FONT_SIZE),
      MAX_VALUE_FONT_SIZE
    );
    const titleFontSize = Math.max(valueFontSize * TITLE_VALUE_RATIO, MIN_TITLE_FONT_SIZE);

    const chartHeight = height - PANEL_PADDING * 2;
    const chartWidth = width / 2;
    let type = !!sparkline ? LayoutType.Wide : LayoutType.WideNoChart;

    if (height < 80 || !sparkline) {
      type = LayoutType.WideNoChart;
    }

    return {
      valueFontSize,
      titleFontSize,
      chartHeight,
      chartWidth,
      type,
      width,
      height,
      colorMode,
      graphMode,
      theme,
      valueColor,
      justifyCenter,
    };
  }

  // handle stacked layouts
  const valueFontSize = Math.min(Math.max(height * VALUE_HEIGHT_RATIO, MIN_VALUE_FONT_SIZE), MAX_VALUE_FONT_SIZE);
  const titleFontSize = Math.max(valueFontSize * TITLE_VALUE_RATIO, MIN_TITLE_FONT_SIZE);
  const valueHeight = valueFontSize * LINE_HEIGHT;
  const titleHeight = titleFontSize * LINE_HEIGHT;

  let chartHeight = height - valueHeight - titleHeight - PANEL_PADDING * 2 - CHART_TOP_MARGIN;
  let chartWidth = width - PANEL_PADDING * 2;
  let type = LayoutType.Stacked;

  if (height < 100 || !sparkline) {
    type = LayoutType.StackedNoChart;
  }

  if (graphMode === BigValueGraphMode.LineWithFill) {
    chartWidth = width;
    chartHeight += PANEL_PADDING;
  }

  return {
    valueFontSize,
    titleFontSize,
    chartHeight,
    chartWidth,
    type,
    width,
    height,
    colorMode,
    graphMode,
    theme,
    valueColor,
    justifyCenter,
  };
}

export function getTitleStyles(layout: LayoutResult) {
  const styles: CSSProperties = {
    fontSize: `${layout.titleFontSize}px`,
    textShadow: '#333 0px 0px 1px',
    color: '#EEE',
  };

  if (layout.theme.isLight) {
    styles.color = 'white';
  }

  return styles;
}

export function getValueStyles(layout: LayoutResult) {
  const styles: CSSProperties = {
    fontSize: `${layout.valueFontSize}px`,
    color: '#EEE',
    textShadow: '#333 0px 0px 1px',
    fontWeight: 500,
    lineHeight: LINE_HEIGHT,
  };

  switch (layout.colorMode) {
    case BigValueColorMode.Value:
      styles.color = layout.valueColor;
  }

  return styles;
}

export function getValueAndTitleContainerStyles(layout: LayoutResult): CSSProperties {
  const styles: CSSProperties = {
    display: 'flex',
  };

  switch (layout.type) {
    case LayoutType.Wide:
      styles.flexDirection = 'column';
      styles.flexGrow = 1;
      break;
    case LayoutType.WideNoChart:
      styles.flexDirection = 'row';
      styles.justifyContent = 'space-between';
      styles.alignItems = 'center';
      styles.flexGrow = 1;
      break;
    case LayoutType.StackedNoChart:
      styles.flexDirection = 'column';
      styles.flexGrow = 1;
      break;
    case LayoutType.Stacked:
    default:
      styles.flexDirection = 'column';
      styles.justifyContent = 'center';
  }

  if (layout.justifyCenter) {
    styles.alignItems = 'center';
    styles.justifyContent = 'center';
  }

  return styles;
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

  const themeFactor = layout.theme.isDark ? 1 : -0.7;

  switch (layout.colorMode) {
    case BigValueColorMode.Background:
      const bgColor2 = tinycolor(layout.valueColor)
        .darken(15 * themeFactor)
        .spin(8)
        .toRgbString();
      const bgColor3 = tinycolor(layout.valueColor)
        .darken(5 * themeFactor)
        .spin(-8)
        .toRgbString();
      panelStyles.background = `linear-gradient(120deg, ${bgColor2}, ${bgColor3})`;
      break;
    case BigValueColorMode.Value:
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

  // default to line graph
  const geomRender = getGraphGeom(layout.colorMode, layout.graphMode);

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

  if (layout.chartWidth === layout.width) {
    chartStyles.position = 'absolute';
    chartStyles.bottom = 0;
    chartStyles.right = 0;
    chartStyles.left = 0;
    chartStyles.right = 0;
    chartStyles.top = 'unset';
  }

  return (
    <Chart
      height={layout.chartHeight}
      width={layout.chartWidth}
      data={data}
      animate={false}
      padding={[4, 0, 0, 0]}
      scale={scales}
      style={chartStyles}
    >
      {geomRender(layout)}
    </Chart>
  );
}

function getGraphGeom(colorMode: BigValueColorMode, graphMode: BigValueGraphMode) {
  // background color mode
  if (colorMode === BigValueColorMode.Background) {
    if (graphMode === BigValueGraphMode.Line) {
      return renderLineGeom;
    }
    if (graphMode === BigValueGraphMode.LineWithFill) {
      return renderVibrant2Geom;
    }
  }

  return renderClassicAreaGeom;
}

function renderLineGeom(layout: LayoutResult) {
  const lineStyle: any = {
    stroke: '#CCC',
    lineWidth: 2,
    shadowBlur: 10,
    shadowColor: '#444',
    shadowOffsetY: 7,
  };

  return <Geom type="line" position="time*value" size={2} color="white" style={lineStyle} shape="smooth" />;
}

function renderVibrant2Geom(layout: LayoutResult) {
  const lineStyle: any = {
    stroke: '#CCC',
    lineWidth: 2,
    shadowBlur: 10,
    shadowColor: '#444',
    shadowOffsetY: -5,
  };

  return (
    <>
      <Geom type="area" position="time*value" size={0} color="rgba(255,255,255,0.4)" style={lineStyle} shape="smooth" />
      <Geom type="line" position="time*value" size={1} color="white" style={lineStyle} shape="smooth" />
    </>
  );
}

function renderClassicAreaGeom(layout: LayoutResult) {
  const lineStyle: any = {
    opacity: 1,
    fillOpacity: 1,
  };

  const fillColor = tinycolor(layout.valueColor)
    .setAlpha(0.2)
    .toRgbString();

  lineStyle.stroke = layout.valueColor;

  return (
    <>
      <Geom type="area" position="time*value" size={0} color={fillColor} style={lineStyle} shape="smooth" />
      <Geom type="line" position="time*value" size={1} color={layout.valueColor} style={lineStyle} shape="smooth" />
    </>
  );
}

/* function renderAreaGeom(layout: LayoutResult) { */
/*   const lineStyle: any = { */
/*     opacity: 1, */
/*     fillOpacity: 1, */
/*   }; */
/*  */
/*   const color1 = tinycolor(layout.valueColor) */
/*     .darken(0) */
/*     .spin(20) */
/*     .toRgbString(); */
/*   const color2 = tinycolor(layout.valueColor) */
/*     .lighten(0) */
/*     .spin(-20) */
/*     .toRgbString(); */
/*  */
/*   const fillColor = `l (0) 0:${color1} 1:${color2}`; */
/*  */
/*   return <Geom type="area" position="time*value" size={0} color={fillColor} style={lineStyle} shape="smooth" />; */
/* } */
