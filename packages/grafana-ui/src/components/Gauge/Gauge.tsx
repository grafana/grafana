import React, { PureComponent } from 'react';
import $ from 'jquery';

import { ValueMapping, Threshold, BasicGaugeColor, TimeSeriesVMs, GrafanaTheme } from '../../types';
import { getMappedValue } from '../../utils/valueMappings';
import { getColorFromHexRgbOrName, getValueFormat } from '../../utils';

type TimeSeriesValue = string | number | null;

export interface Props {
  decimals: number;
  height: number;
  valueMappings: ValueMapping[];
  maxValue: number;
  minValue: number;
  prefix: string;
  timeSeries: TimeSeriesVMs;
  thresholds: Threshold[];
  showThresholdMarkers: boolean;
  showThresholdLabels: boolean;
  stat: string;
  suffix: string;
  unit: string;
  width: number;
  theme?: GrafanaTheme;
}

const FONT_SCALE = 1;

export class Gauge extends PureComponent<Props> {
  canvasElement: any;

  static defaultProps = {
    maxValue: 100,
    valueMappings: [],
    minValue: 0,
    prefix: '',
    showThresholdMarkers: true,
    showThresholdLabels: false,
    suffix: '',
    thresholds: [],
    unit: 'none',
    stat: 'avg',
    theme: GrafanaTheme.Dark,
  };

  componentDidMount() {
    this.draw();
  }

  componentDidUpdate() {
    this.draw();
  }

  formatValue(value: TimeSeriesValue) {
    const { decimals, valueMappings, prefix, suffix, unit } = this.props;

    if (isNaN(value as number)) {
      return value;
    }

    if (valueMappings.length > 0) {
      const valueMappedValue = getMappedValue(valueMappings, value);
      if (valueMappedValue) {
        return `${prefix && prefix + ' '}${valueMappedValue.text}${suffix && ' ' + suffix}`;
      }
    }

    const formatFunc = getValueFormat(unit);
    const formattedValue = formatFunc(value as number, decimals);
    const handleNoValueValue = formattedValue || 'no value';

    return `${prefix && prefix + ' '}${handleNoValueValue}${suffix && ' ' + suffix}`;
  }

  getFontColor(value: TimeSeriesValue) {
    const { thresholds, theme } = this.props;

    if (thresholds.length === 1) {
      return getColorFromHexRgbOrName(thresholds[0].color, theme);
    }

    const atThreshold = thresholds.filter(threshold => (value as number) === threshold.value)[0];
    if (atThreshold) {
      return getColorFromHexRgbOrName(atThreshold.color, theme);
    }

    const belowThreshold = thresholds.filter(threshold => (value as number) > threshold.value);

    if (belowThreshold.length > 0) {
      const nearestThreshold = belowThreshold.sort((t1, t2) => t2.value - t1.value)[0];
      return getColorFromHexRgbOrName(nearestThreshold.color, theme);
    }

    return BasicGaugeColor.Red;
  }

  getFormattedThresholds() {
    const { maxValue, minValue, thresholds, theme } = this.props;

    const thresholdsSortedByIndex = [...thresholds].sort((t1, t2) => t1.index - t2.index);
    const lastThreshold = thresholdsSortedByIndex[thresholdsSortedByIndex.length - 1];

    return [
      ...thresholdsSortedByIndex.map(threshold => {
        if (threshold.index === 0) {
          return { value: minValue, color: getColorFromHexRgbOrName(threshold.color, theme) };
        }

        const previousThreshold = thresholdsSortedByIndex[threshold.index - 1];
        return { value: threshold.value, color: getColorFromHexRgbOrName(previousThreshold.color, theme) };
      }),
      { value: maxValue, color: getColorFromHexRgbOrName(lastThreshold.color, theme) },
    ];
  }

  getFontScale(length: number): number {
    if (length > 12) {
      return FONT_SCALE - length * 5 / 120;
    }
    return FONT_SCALE - length * 5 / 105;
  }

  draw() {
    const {
      maxValue,
      minValue,
      timeSeries,
      showThresholdLabels,
      showThresholdMarkers,
      width,
      height,
      stat,
      theme,
    } = this.props;

    let value: TimeSeriesValue = '';

    if (timeSeries[0]) {
      value = timeSeries[0].stats[stat];
    } else {
      value = null;
    }

    const formattedValue = this.formatValue(value) as string;
    const dimension = Math.min(width, height * 1.3);
    const backgroundColor = theme === GrafanaTheme.Light ? 'rgb(230,230,230)' : 'rgb(38,38,38)';
    const gaugeWidthReduceRatio = showThresholdLabels ? 1.5 : 1;
    const gaugeWidth = Math.min(dimension / 6, 60) / gaugeWidthReduceRatio;
    const thresholdMarkersWidth = gaugeWidth / 5;
    const fontSize =
      Math.min(dimension / 5, 100) * (formattedValue !== null ? this.getFontScale(formattedValue.length) : 1);
    const thresholdLabelFontSize = fontSize / 2.5;

    const options = {
      series: {
        gauges: {
          gauge: {
            min: minValue,
            max: maxValue,
            background: { color: backgroundColor },
            border: { color: null },
            shadow: { show: false },
            width: gaugeWidth,
          },
          frame: { show: false },
          label: { show: false },
          layout: { margin: 0, thresholdWidth: 0 },
          cell: { border: { width: 0 } },
          threshold: {
            values: this.getFormattedThresholds(),
            label: {
              show: showThresholdLabels,
              margin: thresholdMarkersWidth + 1,
              font: { size: thresholdLabelFontSize },
            },
            show: showThresholdMarkers,
            width: thresholdMarkersWidth,
          },
          value: {
            color: this.getFontColor(value),
            formatter: () => {
              return formattedValue;
            },
            font: { size: fontSize, family: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
          },
          show: true,
        },
      },
    };

    const plotSeries = { data: [[0, value]] };

    try {
      $.plot(this.canvasElement, [plotSeries], options);
    } catch (err) {
      console.log('Gauge rendering error', err, options, timeSeries);
    }
  }

  render() {
    const { height, width } = this.props;

    return (
      <div className="singlestat-panel">
        <div
          style={{
            height: `${height * 0.9}px`,
            width: `${Math.min(width, height * 1.3)}px`,
            top: '10px',
            margin: 'auto',
          }}
          ref={element => (this.canvasElement = element)}
        />
      </div>
    );
  }
}

export default Gauge;
