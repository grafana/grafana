import { CSSProperties } from 'react';
import tinycolor from 'tinycolor2';

import { getColorFromHexRgbOrName, GrafanaTheme } from '@grafana/data';
import { BigValueColorMode, BigValueGraphMode, Props, BigValueJustifyMode } from './BigValue';

const MIN_VALUE_FONT_SIZE = 20;
const MAX_VALUE_FONT_SIZE = 50;
const MIN_TITLE_FONT_SIZE = 14;
const TITLE_VALUE_RATIO = 0.45;
const VALUE_HEIGHT_RATIO = 0.25;
const VALUE_HEIGHT_RATIO_WIDE = 0.3;
const LINE_HEIGHT = 1.2;
const PANEL_PADDING = 16;
export const CHART_TOP_MARGIN = 8;

export interface LayoutResult {
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
export enum LayoutType {
  Stacked,
  StackedNoChart,
  Wide,
  WideNoChart,
}
export function shouldJustifyCenter(props: Props) {
  const { value, justifyMode } = props;
  if (justifyMode === BigValueJustifyMode.Center) {
    return true;
  }
  return (value.title ?? '').length === 0;
}

export function calculateLayout(props: Props): LayoutResult {
  const { width, height, sparkline, colorMode, theme, value, graphMode } = props;
  const useWideLayout = width / height > 2.8;
  const valueColor = getColorFromHexRgbOrName(value.color || 'green', theme.type);
  const justifyCenter = shouldJustifyCenter(props);

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

  if (graphMode === BigValueGraphMode.Area) {
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
