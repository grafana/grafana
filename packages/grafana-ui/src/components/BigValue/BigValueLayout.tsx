import React, { CSSProperties } from 'react';
import tinycolor from 'tinycolor2';

import { formattedValueToString, DisplayValue, FieldConfig, FieldType, VizOrientation } from '@grafana/data';
import { GraphDrawStyle, GraphFieldConfig } from '@grafana/schema';

import { getTextColorForAlphaBackground } from '../../utils';
import { calculateFontSize } from '../../utils/measureText';
import { Sparkline } from '../Sparkline/Sparkline';

import { BigValueColorMode, Props, BigValueJustifyMode, BigValueTextMode } from './BigValue';

const LINE_HEIGHT = 1.2;
const MAX_TITLE_SIZE = 30;
const VALUE_FONT_WEIGHT = 500;

export abstract class BigValueLayout {
  titleFontSize: number;
  valueFontSize: number;
  chartHeight: number;
  chartWidth: number;
  valueColor: string;
  panelPadding: number;
  justifyCenter: boolean;
  titleToAlignTo?: string;
  valueToAlignTo: string;
  maxTextWidth: number;
  maxTextHeight: number;
  textValues: BigValueTextValues;

  constructor(private props: Props) {
    const { width, height, value, text } = props;

    this.valueColor = value.color ?? 'gray';
    this.panelPadding = height > 100 ? 12 : 8;
    this.textValues = getTextValues(props);
    this.justifyCenter = shouldJustifyCenter(props.justifyMode, this.textValues.title);
    this.valueToAlignTo = this.textValues.valueToAlignTo;
    this.titleToAlignTo = this.textValues.titleToAlignTo;
    this.titleFontSize = 0;
    this.valueFontSize = 0;
    this.chartHeight = 0;
    this.chartWidth = 0;
    this.maxTextWidth = width - this.panelPadding * 2;
    this.maxTextHeight = height - this.panelPadding * 2;

    // Explicit font sizing
    if (text) {
      if (text.titleSize) {
        this.titleFontSize = text.titleSize;
        this.titleToAlignTo = undefined;
      }
      if (text.valueSize) {
        this.valueFontSize = text.valueSize;
        this.valueToAlignTo = '';
      }
    }
  }

  getTitleStyles(): CSSProperties {
    const styles: CSSProperties = {
      fontSize: `${this.titleFontSize}px`,
      lineHeight: LINE_HEIGHT,
    };

    if (this.props.parentOrientation === VizOrientation.Horizontal && this.justifyCenter) {
      styles.paddingRight = '0.75ch';
    }

    if (
      this.props.colorMode === BigValueColorMode.Background ||
      this.props.colorMode === BigValueColorMode.BackgroundSolid
    ) {
      styles.color = getTextColorForAlphaBackground(this.valueColor, this.props.theme.isDark);
    }

    return styles;
  }

  getValueStyles(): CSSProperties {
    const styles: CSSProperties = {
      fontSize: this.valueFontSize,
      fontWeight: VALUE_FONT_WEIGHT,
      lineHeight: LINE_HEIGHT,
      position: 'relative',
      zIndex: 1,
    };

    if (this.justifyCenter) {
      styles.textAlign = 'center';
    }

    switch (this.props.colorMode) {
      case BigValueColorMode.Value:
        styles.color = this.valueColor;
        break;
      case BigValueColorMode.Background:
      case BigValueColorMode.BackgroundSolid:
        styles.color = getTextColorForAlphaBackground(this.valueColor, this.props.theme.isDark);
        break;
      case BigValueColorMode.None:
        styles.color = this.props.theme.colors.text.primary;
        break;
    }

    return styles;
  }

  getValueAndTitleContainerStyles() {
    const styles: CSSProperties = {
      display: 'flex',
    };

    if (this.justifyCenter) {
      styles.alignItems = 'center';
      styles.justifyContent = 'center';
      styles.flexGrow = 1;
    }

    return styles;
  }

  getPanelStyles(): CSSProperties {
    const { width, height, theme, colorMode } = this.props;

    const panelStyles: CSSProperties = {
      width: `${width}px`,
      height: `${height}px`,
      padding: `${this.panelPadding}px`,
      borderRadius: theme.shape.borderRadius(),
      position: 'relative',
      display: 'flex',
    };

    const themeFactor = theme.isDark ? 1 : -0.7;

    switch (colorMode) {
      case BigValueColorMode.Background:
        const bgColor2 = tinycolor(this.valueColor)
          .darken(15 * themeFactor)
          .spin(8)
          .toRgbString();
        const bgColor3 = tinycolor(this.valueColor)
          .darken(5 * themeFactor)
          .spin(-8)
          .toRgbString();
        panelStyles.background = `linear-gradient(120deg, ${bgColor2}, ${bgColor3})`;
        break;
      case BigValueColorMode.BackgroundSolid:
        panelStyles.background = tinycolor(this.valueColor).toString();
        break;
      case BigValueColorMode.Value:
        panelStyles.background = `transparent`;
        break;
    }

    if (this.justifyCenter) {
      panelStyles.alignItems = 'center';
      panelStyles.flexDirection = 'row';
    }

    return panelStyles;
  }

  renderChart(): JSX.Element | null {
    const { sparkline, colorMode } = this.props;

    if (!sparkline || sparkline.y?.type !== FieldType.number) {
      return null;
    }

    let fillColor: string;
    let lineColor: string;

    switch (colorMode) {
      case BigValueColorMode.Background:
      case BigValueColorMode.BackgroundSolid:
        fillColor = 'rgba(255,255,255,0.4)';
        lineColor = tinycolor(this.valueColor).brighten(40).toRgbString();
        break;
      case BigValueColorMode.None:
      case BigValueColorMode.Value:
      default:
        lineColor = this.valueColor;
        fillColor = tinycolor(this.valueColor).setAlpha(0.2).toRgbString();
        break;
    }

    // The graph field configuration applied to Y values
    const config: FieldConfig<GraphFieldConfig> = {
      custom: {
        drawStyle: GraphDrawStyle.Line,
        lineWidth: 1,
        fillColor,
        lineColor,
      },
    };

    return (
      <div style={this.getChartStyles()}>
        <Sparkline
          height={this.chartHeight}
          width={this.chartWidth}
          sparkline={sparkline}
          config={config}
          theme={this.props.theme}
        />
      </div>
    );
  }
  getChartStyles(): CSSProperties {
    return {
      position: 'absolute',
      right: 0,
      bottom: 0,
    };
  }
}

export class WideNoChartLayout extends BigValueLayout {
  constructor(props: Props) {
    super(props);

    const valueWidthPercent = this.titleToAlignTo?.length ? 0.3 : 1.0;

    if (this.valueToAlignTo.length) {
      // initial value size
      this.valueFontSize = calculateFontSize(
        this.valueToAlignTo,
        this.maxTextWidth * valueWidthPercent,
        this.maxTextHeight,
        LINE_HEIGHT,
        undefined,
        VALUE_FONT_WEIGHT
      );
    }

    if (this.titleToAlignTo?.length) {
      // How big can we make the title and still have it fit
      this.titleFontSize = calculateFontSize(
        this.titleToAlignTo,
        this.maxTextWidth * 0.6,
        this.maxTextHeight,
        LINE_HEIGHT,
        MAX_TITLE_SIZE
      );

      // make sure it's a bit smaller than valueFontSize
      this.titleFontSize = Math.min(this.valueFontSize * 0.7, this.titleFontSize);
    }
  }

  getValueAndTitleContainerStyles() {
    const styles = super.getValueAndTitleContainerStyles();
    styles.flexDirection = 'row';
    styles.alignItems = 'center';
    styles.flexGrow = 1;

    if (!this.justifyCenter) {
      styles.justifyContent = 'space-between';
    }

    return styles;
  }

  renderChart(): JSX.Element | null {
    return null;
  }

  getPanelStyles() {
    const panelStyles = super.getPanelStyles();
    panelStyles.alignItems = 'center';
    return panelStyles;
  }
}

export class WideWithChartLayout extends BigValueLayout {
  constructor(props: Props) {
    super(props);

    const { width, height } = props;

    const chartHeightPercent = 0.5;
    const titleWidthPercent = 0.6;
    const valueWidthPercent = 1 - titleWidthPercent;
    const textHeightPercent = 0.4;

    this.chartWidth = width;
    this.chartHeight = height * chartHeightPercent;

    if (this.titleToAlignTo?.length) {
      this.titleFontSize = calculateFontSize(
        this.titleToAlignTo,
        this.maxTextWidth * titleWidthPercent,
        this.maxTextHeight * textHeightPercent,
        LINE_HEIGHT,
        MAX_TITLE_SIZE
      );
    }

    if (this.valueToAlignTo.length) {
      this.valueFontSize = calculateFontSize(
        this.valueToAlignTo,
        this.maxTextWidth * valueWidthPercent,
        this.maxTextHeight * chartHeightPercent,
        LINE_HEIGHT,
        undefined,
        VALUE_FONT_WEIGHT
      );
    }
  }

  getValueAndTitleContainerStyles() {
    const styles = super.getValueAndTitleContainerStyles();
    styles.flexDirection = 'row';
    styles.flexGrow = 1;

    if (!this.justifyCenter) {
      styles.justifyContent = 'space-between';
    }

    return styles;
  }

  getPanelStyles() {
    const styles = super.getPanelStyles();
    styles.flexDirection = 'row';
    styles.justifyContent = 'space-between';
    return styles;
  }
}

export class StackedWithChartLayout extends BigValueLayout {
  constructor(props: Props) {
    super(props);

    const { width, height } = props;
    const titleHeightPercent = 0.15;
    const chartHeightPercent = 0.25;
    let titleHeight = 0;

    this.chartHeight = height * chartHeightPercent;
    this.chartWidth = width;

    if (this.titleToAlignTo?.length) {
      this.titleFontSize = calculateFontSize(
        this.titleToAlignTo,
        this.maxTextWidth,
        height * titleHeightPercent,
        LINE_HEIGHT,
        MAX_TITLE_SIZE
      );

      titleHeight = this.titleFontSize * LINE_HEIGHT;
    }

    if (this.valueToAlignTo.length) {
      this.valueFontSize = calculateFontSize(
        this.valueToAlignTo,
        this.maxTextWidth,
        this.maxTextHeight - this.chartHeight - titleHeight,
        LINE_HEIGHT,
        undefined,
        VALUE_FONT_WEIGHT
      );
    }

    // make title fontsize it's a bit smaller than valueFontSize
    if (this.titleToAlignTo?.length) {
      this.titleFontSize = Math.min(this.valueFontSize * 0.7, this.titleFontSize);
    }

    // make chart take up unused space
    this.chartHeight = height - this.titleFontSize * LINE_HEIGHT - this.valueFontSize * LINE_HEIGHT;
  }

  getValueAndTitleContainerStyles() {
    const styles = super.getValueAndTitleContainerStyles();
    styles.flexDirection = 'column';
    styles.justifyContent = 'center';
    return styles;
  }

  getPanelStyles() {
    const styles = super.getPanelStyles();
    styles.flexDirection = 'column';
    return styles;
  }
}

export class StackedWithNoChartLayout extends BigValueLayout {
  constructor(props: Props) {
    super(props);

    const { height } = props;
    const titleHeightPercent = 0.15;
    let titleHeight = 0;

    if (this.titleToAlignTo?.length) {
      this.titleFontSize = calculateFontSize(
        this.titleToAlignTo,
        this.maxTextWidth,
        height * titleHeightPercent,
        LINE_HEIGHT,
        MAX_TITLE_SIZE
      );

      titleHeight = this.titleFontSize * LINE_HEIGHT;
    }

    if (this.valueToAlignTo.length) {
      this.valueFontSize = calculateFontSize(
        this.valueToAlignTo,
        this.maxTextWidth,
        this.maxTextHeight - titleHeight,
        LINE_HEIGHT,
        undefined,
        VALUE_FONT_WEIGHT
      );
    }

    if (this.titleToAlignTo?.length) {
      // make title fontsize it's a bit smaller than valueFontSize
      this.titleFontSize = Math.min(this.valueFontSize * 0.7, this.titleFontSize);
    }
  }

  getValueAndTitleContainerStyles() {
    const styles = super.getValueAndTitleContainerStyles();
    styles.flexDirection = 'column';
    styles.flexGrow = 1;
    return styles;
  }

  renderChart(): JSX.Element | null {
    return null;
  }

  getPanelStyles() {
    const styles = super.getPanelStyles();
    styles.alignItems = 'center';
    return styles;
  }
}

export function buildLayout(props: Props): BigValueLayout {
  const { width, height, sparkline } = props;
  const useWideLayout = width / height > 2.5;

  if (useWideLayout) {
    if (height > 50 && !!sparkline && sparkline.y.values.length > 1) {
      return new WideWithChartLayout(props);
    } else {
      return new WideNoChartLayout(props);
    }
  }

  // stacked layouts
  if (height > 100 && sparkline && sparkline.y.values.length > 1) {
    return new StackedWithChartLayout(props);
  } else {
    return new StackedWithNoChartLayout(props);
  }
}

export function shouldJustifyCenter(justifyMode?: BigValueJustifyMode, title?: string) {
  if (justifyMode === BigValueJustifyMode.Center) {
    return true;
  }

  return (title ?? '').length === 0;
}

export interface BigValueTextValues extends DisplayValue {
  valueToAlignTo: string;
  titleToAlignTo?: string;
  tooltip?: string;
}

function getTextValues(props: Props): BigValueTextValues {
  const { value, alignmentFactors, count } = props;
  let { textMode } = props;

  const titleToAlignTo = alignmentFactors ? alignmentFactors.title : value.title;
  const valueToAlignTo = formattedValueToString(alignmentFactors ? alignmentFactors : value);

  // In the auto case we only show title if this big value is part of more panes (count > 1)
  if (textMode === BigValueTextMode.Auto && (count ?? 1) === 1) {
    textMode = BigValueTextMode.Value;
  }

  switch (textMode) {
    case BigValueTextMode.Name:
      return {
        ...value,
        title: undefined,
        prefix: undefined,
        suffix: undefined,
        text: value.title || '',
        titleToAlignTo: undefined,
        valueToAlignTo: titleToAlignTo ?? '',
        tooltip: formattedValueToString(value),
      };
    case BigValueTextMode.Value:
      return {
        ...value,
        title: undefined,
        titleToAlignTo: undefined,
        valueToAlignTo,
        tooltip: value.title,
      };
    case BigValueTextMode.None:
      return {
        numeric: value.numeric,
        color: value.color,
        title: undefined,
        text: '',
        titleToAlignTo: undefined,
        valueToAlignTo: '1',
        tooltip: `Name: ${value.title}\nValue: ${formattedValueToString(value)}`,
      };
    case BigValueTextMode.ValueAndName:
    default:
      return {
        ...value,
        titleToAlignTo,
        valueToAlignTo,
      };
  }
}
