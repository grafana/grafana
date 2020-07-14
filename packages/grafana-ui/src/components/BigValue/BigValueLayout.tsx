// Libraries
import React, { CSSProperties } from 'react';
import tinycolor from 'tinycolor2';
import { Chart, Geom } from 'bizcharts';

// Utils
import { getColorFromHexRgbOrName, formattedValueToString, DisplayValue } from '@grafana/data';
import { calculateFontSize } from '../../utils/measureText';

// Types
import { BigValueColorMode, Props, BigValueJustifyMode, BigValueTextMode } from './BigValue';

const LINE_HEIGHT = 1.2;
const MAX_TITLE_SIZE = 30;

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
    const { width, height, value, theme } = props;

    this.valueColor = getColorFromHexRgbOrName(value.color || 'green', theme.type);
    this.panelPadding = height > 100 ? 12 : 8;
    this.textValues = getTextValues(props);
    this.justifyCenter = shouldJustifyCenter(props.justifyMode, this.textValues.title);
    this.valueToAlignTo = this.textValues.valueToAlignTo;
    this.titleToAlignTo = this.textValues.titleToAlignTo;
    this.titleFontSize = 14;
    this.valueFontSize = 14;
    this.chartHeight = 0;
    this.chartWidth = 0;
    this.maxTextWidth = width - this.panelPadding * 2;
    this.maxTextHeight = height - this.panelPadding * 2;
  }

  getTitleStyles(): CSSProperties {
    const styles: CSSProperties = {
      fontSize: `${this.titleFontSize}px`,
      lineHeight: LINE_HEIGHT,
    };

    if (this.props.colorMode === BigValueColorMode.Background) {
      styles.color = 'white';
    }

    return styles;
  }

  getValueStyles(): CSSProperties {
    const styles: CSSProperties = {
      fontSize: this.valueFontSize,
      fontWeight: 500,
      lineHeight: LINE_HEIGHT,
    };

    switch (this.props.colorMode) {
      case BigValueColorMode.Value:
        styles.color = this.valueColor;
        break;
      case BigValueColorMode.Background:
        styles.color = 'white';
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
      borderRadius: '3px',
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
    const { sparkline } = this.props;

    if (!sparkline || sparkline.data.length === 0) {
      return null;
    }

    const data = sparkline.data.map(values => {
      return { time: values[0], value: values[1], name: 'A' };
    });

    const scales = {
      time: {
        type: 'time',
        min: sparkline.xMin,
        max: sparkline.xMax,
      },
      value: {
        min: sparkline.yMin,
        max: sparkline.yMax,
      },
    };

    if (sparkline.xMax && sparkline.xMin) {
      // Having the last data point align with the edge of the panel looks good
      // So if it's close adjust time.max to the last data point time
      const timeDelta = sparkline.xMax - sparkline.xMin;
      const lastDataPointTime = data[data.length - 1].time || 0;
      const lastTimeDiffFromMax = Math.abs(sparkline.xMax - lastDataPointTime);

      // if last data point is just 5% or lower from the edge adjust it
      if (lastTimeDiffFromMax / timeDelta < 0.05) {
        scales.time.max = lastDataPointTime;
      }
    }

    return (
      <Chart
        height={this.chartHeight}
        width={this.chartWidth}
        data={data}
        animate={false}
        padding={[4, 0, 0, 0]}
        scale={scales}
        style={this.getChartStyles()}
      >
        {this.renderGeom()}
      </Chart>
    );
  }

  renderGeom(): JSX.Element {
    const { colorMode } = this.props;

    const lineStyle: any = {
      opacity: 1,
      fillOpacity: 1,
      lineWidth: 2,
    };

    let fillColor: string;
    let lineColor: string;

    switch (colorMode) {
      case BigValueColorMode.Value:
        lineColor = this.valueColor;
        fillColor = tinycolor(this.valueColor)
          .setAlpha(0.2)
          .toRgbString();
        break;
      case BigValueColorMode.Background:
        fillColor = 'rgba(255,255,255,0.4)';
        lineColor = tinycolor(this.valueColor)
          .brighten(40)
          .toRgbString();
    }

    lineStyle.stroke = lineColor;

    return (
      <>
        <Geom type="area" position="time*value" size={0} color={fillColor} style={lineStyle} shape="smooth" />
        <Geom type="line" position="time*value" size={1} color={lineColor} style={lineStyle} shape="smooth" />
      </>
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

    const valueWidthPercent = 0.3;

    if (this.titleToAlignTo && this.titleToAlignTo.length > 0) {
      // initial value size
      this.valueFontSize = calculateFontSize(
        this.valueToAlignTo,
        this.maxTextWidth * valueWidthPercent,
        this.maxTextHeight,
        LINE_HEIGHT
      );

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
    } else {
      // if no title wide
      this.valueFontSize = calculateFontSize(this.valueToAlignTo, this.maxTextWidth, this.maxTextHeight, LINE_HEIGHT);
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

    if (this.titleToAlignTo && this.titleToAlignTo.length > 0) {
      this.titleFontSize = calculateFontSize(
        this.titleToAlignTo,
        this.maxTextWidth * titleWidthPercent,
        this.maxTextHeight * textHeightPercent,
        LINE_HEIGHT,
        MAX_TITLE_SIZE
      );
    }

    this.valueFontSize = calculateFontSize(
      this.valueToAlignTo,
      this.maxTextWidth * valueWidthPercent,
      this.maxTextHeight * chartHeightPercent,
      LINE_HEIGHT
    );
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

    if (this.titleToAlignTo && this.titleToAlignTo.length > 0) {
      this.titleFontSize = calculateFontSize(
        this.titleToAlignTo,
        this.maxTextWidth,
        height * titleHeightPercent,
        LINE_HEIGHT,
        MAX_TITLE_SIZE
      );

      titleHeight = this.titleFontSize * LINE_HEIGHT;
    }

    this.valueFontSize = calculateFontSize(
      this.valueToAlignTo,
      this.maxTextWidth,
      this.maxTextHeight - this.chartHeight - titleHeight,
      LINE_HEIGHT
    );

    // make title fontsize it's a bit smaller than valueFontSize
    this.titleFontSize = Math.min(this.valueFontSize * 0.7, this.titleFontSize);

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

    if (this.titleToAlignTo && this.titleToAlignTo.length > 0) {
      this.titleFontSize = calculateFontSize(
        this.titleToAlignTo,
        this.maxTextWidth,
        height * titleHeightPercent,
        LINE_HEIGHT,
        MAX_TITLE_SIZE
      );

      titleHeight = this.titleFontSize * LINE_HEIGHT;
    }

    this.valueFontSize = calculateFontSize(
      this.valueToAlignTo,
      this.maxTextWidth,
      this.maxTextHeight - titleHeight,
      LINE_HEIGHT
    );

    // make title fontsize it's a bit smaller than valueFontSize
    this.titleFontSize = Math.min(this.valueFontSize * 0.7, this.titleFontSize);
  }

  getValueAndTitleContainerStyles() {
    const styles = super.getValueAndTitleContainerStyles();
    styles.flexDirection = 'column';
    styles.flexGrow = 1;
    return styles;
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
    if (height > 50 && !!sparkline) {
      return new WideWithChartLayout(props);
    } else {
      return new WideNoChartLayout(props);
    }
  }

  // stacked layouts
  if (height > 100 && !!sparkline) {
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
