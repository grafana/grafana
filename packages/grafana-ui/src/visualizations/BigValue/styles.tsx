// Libraries
import { CSSProperties } from 'react';
import tinycolor from 'tinycolor2';

// Utils
import { getColorFromHexRgbOrName, GrafanaTheme, formattedValueToString } from '@grafana/data';
import { calculateFontSize } from '../../utils/measureText';

// Types
import { BigValueColorMode, BigValueGraphMode, Props, BigValueJustifyMode } from './BigValue';

const LINE_HEIGHT = 1.2;

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
  panelPadding: number;
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
  const { width, height, sparkline, colorMode, theme, value, graphMode, alignmentFactors } = props;
  const useWideLayout = width / height > 2.5;
  const valueColor = getColorFromHexRgbOrName(value.color || 'green', theme.type);
  const justifyCenter = shouldJustifyCenter(props);
  const panelPadding = height > 100 ? 12 : 8;
  const titleToAlignTo = alignmentFactors ? alignmentFactors.title : value.title;
  const valueToAlignTo = formattedValueToString(alignmentFactors ? alignmentFactors : value);

  const maxTitleFontSize = 30;
  const maxTextWidth = width - panelPadding * 2;
  const maxTextHeight = height - panelPadding * 2;

  let layoutType = LayoutType.Stacked;
  let chartHeight = 0;
  let chartWidth = 0;
  let titleHeight = 0;
  let titleFontSize = 0;
  let valueFontSize = 14;

  if (useWideLayout) {
    // Detect auto wide layout type
    layoutType = height > 50 && !!sparkline ? LayoutType.Wide : LayoutType.WideNoChart;

    // Wide no chart mode
    if (layoutType === LayoutType.WideNoChart) {
      const valueWidthPercent = 0.3;

      if (titleToAlignTo && titleToAlignTo.length > 0) {
        // initial value size
        valueFontSize = calculateFontSize(valueToAlignTo, maxTextWidth * valueWidthPercent, maxTextHeight, LINE_HEIGHT);
        // How big can we make the title and still have it fit
        titleFontSize = calculateFontSize(
          titleToAlignTo,
          maxTextWidth * 0.6,
          maxTextHeight,
          LINE_HEIGHT,
          maxTitleFontSize
        );

        // make sure it's a bit smaller than valueFontSize
        titleFontSize = Math.min(valueFontSize * 0.7, titleFontSize);
        titleHeight = titleFontSize * LINE_HEIGHT;
      } else {
        // if no title wide
        valueFontSize = calculateFontSize(valueToAlignTo, maxTextWidth, maxTextHeight, LINE_HEIGHT);
      }
    } else {
      // wide with chart
      const chartHeightPercent = 0.5;
      const titleWidthPercent = 0.6;
      const valueWidthPercent = 1 - titleWidthPercent;
      const textHeightPercent = 0.4;

      chartWidth = width;
      chartHeight = height * chartHeightPercent;

      if (titleToAlignTo && titleToAlignTo.length > 0) {
        titleFontSize = calculateFontSize(
          titleToAlignTo,
          maxTextWidth * titleWidthPercent,
          maxTextHeight * textHeightPercent,
          LINE_HEIGHT,
          maxTitleFontSize
        );
        titleHeight = titleFontSize * LINE_HEIGHT;
      }

      valueFontSize = calculateFontSize(
        valueToAlignTo,
        maxTextWidth * valueWidthPercent,
        maxTextHeight * chartHeightPercent,
        LINE_HEIGHT
      );
    }
  } else {
    // Stacked layout (title, value, chart)
    const titleHeightPercent = 0.15;
    const chartHeightPercent = 0.25;

    // Does a chart fit or exist?
    if (height < 100 || !sparkline) {
      layoutType = LayoutType.StackedNoChart;
    } else {
      // we have chart
      chartHeight = height * chartHeightPercent;
      chartWidth = width;
    }

    if (titleToAlignTo && titleToAlignTo.length > 0) {
      titleFontSize = calculateFontSize(
        titleToAlignTo,
        maxTextWidth,
        height * titleHeightPercent,
        LINE_HEIGHT,
        maxTitleFontSize
      );
      titleHeight = titleFontSize * LINE_HEIGHT;
    }

    valueFontSize = calculateFontSize(
      valueToAlignTo,
      maxTextWidth,
      maxTextHeight - chartHeight - titleHeight,
      LINE_HEIGHT
    );
    // make title fontsize it's a bit smaller than valueFontSize
    titleFontSize = Math.min(valueFontSize * 0.7, titleFontSize);
  }

  return {
    valueFontSize,
    titleFontSize,
    chartHeight,
    chartWidth,
    type: layoutType,
    width,
    height,
    colorMode,
    graphMode,
    theme,
    valueColor,
    justifyCenter,
    panelPadding,
  };
}

export function getTitleStyles(layout: LayoutResult) {
  const styles: CSSProperties = {
    fontSize: `${layout.titleFontSize}px`,
    textShadow: '#333 0px 0px 1px',
    color: '#EEE',
    lineHeight: LINE_HEIGHT,
  };

  if (layout.theme.isLight) {
    styles.color = 'white';
  }

  return styles;
}

export function getValueStyles(layout: LayoutResult) {
  const styles: CSSProperties = {
    fontSize: layout.valueFontSize,
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
      styles.flexDirection = 'row';
      styles.justifyContent = 'space-between';
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
    styles.flexGrow = 1;
  }

  return styles;
}

export function getPanelStyles(layout: LayoutResult) {
  const panelStyles: CSSProperties = {
    width: `${layout.width}px`,
    height: `${layout.height}px`,
    padding: `${layout.panelPadding}px`,
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
      panelStyles.justifyContent = 'space-between';
      break;
    case LayoutType.WideNoChart:
      panelStyles.alignItems = 'center';
      break;
  }

  if (layout.justifyCenter) {
    panelStyles.alignItems = 'center';
    panelStyles.flexDirection = 'row';
  }

  return panelStyles;
}
