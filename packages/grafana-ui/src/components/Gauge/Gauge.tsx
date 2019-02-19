import React, { PureComponent } from 'react';
import $ from 'jquery';

import { ValueMapping, Threshold, GrafanaThemeType } from '../../types';
import { getMappedValue } from '../../utils/valueMappings';
import { getColorFromHexRgbOrName, getValueFormat, getThresholdForValue } from '../../utils';
import { Themeable } from '../../index';

type GaugeValue = string | number | null;

export interface Props extends Themeable {
  decimals?: number | null;
  height: number;
  valueMappings: ValueMapping[];
  maxValue: number;
  minValue: number;
  prefix: string;
  thresholds: Threshold[];
  showThresholdMarkers: boolean;
  showThresholdLabels: boolean;
  stat: string;
  suffix: string;
  unit: string;
  width: number;
  value: number;
}

const FONT_SCALE = 1;

export class Gauge extends PureComponent<Props> {
  canvasElement: any;

  static defaultProps: Partial<Props> = {
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
  };

  componentDidMount() {
    this.draw();
  }

  componentDidUpdate() {
    this.draw();
  }

  formatValue(value: GaugeValue) {
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

  getFontColor(value: GaugeValue): string {
    const { thresholds, theme } = this.props;

    const activeThreshold = getThresholdForValue(thresholds, value);

    if (activeThreshold !== null) {
      return getColorFromHexRgbOrName(activeThreshold.color, theme.type);
    }

    return '';
  }

  getFormattedThresholds() {
    const { maxValue, minValue, thresholds, theme } = this.props;

    const lastThreshold = thresholds[thresholds.length - 1];

    return [
      ...thresholds.map(threshold => {
        if (threshold.index === 0) {
          return { value: minValue, color: getColorFromHexRgbOrName(threshold.color, theme.type) };
        }

        const previousThreshold = thresholds[threshold.index - 1];
        return { value: threshold.value, color: getColorFromHexRgbOrName(previousThreshold.color, theme.type) };
      }),
      { value: maxValue, color: getColorFromHexRgbOrName(lastThreshold.color, theme.type) },
    ];
  }

  getFontScale(length: number): number {
    if (length > 12) {
      return FONT_SCALE - length * 5 / 120;
    }
    return FONT_SCALE - length * 5 / 105;
  }

  draw() {
    const { maxValue, minValue, showThresholdLabels, showThresholdMarkers, width, height, theme, value } = this.props;

    const formattedValue = this.formatValue(value) as string;
    const dimension = Math.min(width, height * 1.3);
    const backgroundColor = theme.type === GrafanaThemeType.Light ? 'rgb(230,230,230)' : theme.colors.dark3;

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
      console.log('Gauge rendering error', err, options, value);
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
