import $ from 'jquery';
import React, { PureComponent } from 'react';

import {
  DisplayValue,
  formattedValueToString,
  FieldConfig,
  ThresholdsMode,
  GAUGE_DEFAULT_MAXIMUM,
  GAUGE_DEFAULT_MINIMUM,
  GrafanaTheme,
  GrafanaTheme2,
} from '@grafana/data';
import { VizTextDisplayOptions } from '@grafana/schema';

import { calculateFontSize } from '../../utils/measureText';

import { calculateGaugeAutoProps, DEFAULT_THRESHOLDS, getFormattedThresholds } from './utils';

export interface Props {
  height: number;
  field: FieldConfig;
  showThresholdMarkers: boolean;
  showThresholdLabels: boolean;
  width: number;
  value: DisplayValue;
  text?: VizTextDisplayOptions;
  onClick?: React.MouseEventHandler<HTMLElement>;
  className?: string;
  theme: GrafanaTheme | GrafanaTheme2;
}

export class Gauge extends PureComponent<Props> {
  canvasElement: HTMLDivElement | null = null;

  static defaultProps: Partial<Props> = {
    showThresholdMarkers: true,
    showThresholdLabels: false,
    field: {
      min: 0,
      max: 100,
      thresholds: DEFAULT_THRESHOLDS,
    },
  };

  componentDidMount() {
    this.draw();
  }

  componentDidUpdate() {
    this.draw();
  }

  draw() {
    const { field, showThresholdLabels, showThresholdMarkers, width, height, theme, value } = this.props;

    const autoProps = calculateGaugeAutoProps(width, height, value.title);
    const dimension = Math.min(width, autoProps.gaugeHeight);
    const backgroundColor = 'v1' in theme ? theme.colors.background.secondary : theme.colors.bg2;
    const gaugeWidthReduceRatio = showThresholdLabels ? 1.5 : 1;
    const gaugeWidth = Math.min(dimension / 5.5, 40) / gaugeWidthReduceRatio;
    const thresholdMarkersWidth = gaugeWidth / 5;
    const text = formattedValueToString(value);
    // This not 100% accurate as I am unsure of flot's calculations here
    const valueWidthBase = Math.min(width, dimension * 1.3) * 0.9;
    // remove gauge & marker width (on left and right side)
    // and 10px is some padding that flot adds to the outer canvas
    const valueWidth =
      valueWidthBase -
      ((gaugeWidth + (showThresholdMarkers ? thresholdMarkersWidth : 0) + (showThresholdLabels ? 10 : 0)) * 2 + 10);
    const fontSize = this.props.text?.valueSize ?? calculateFontSize(text, valueWidth, dimension, 1, gaugeWidth * 1.7);
    const thresholdLabelFontSize = Math.max(fontSize / 2.5, 12);

    let min = field.min ?? GAUGE_DEFAULT_MINIMUM;
    let max = field.max ?? GAUGE_DEFAULT_MAXIMUM;
    let numeric = value.numeric;

    if (field.thresholds?.mode === ThresholdsMode.Percentage) {
      min = 0;
      max = 100;
      if (value.percent === undefined) {
        numeric = ((numeric - min) / (max - min)) * 100;
      } else {
        numeric = value.percent! * 100;
      }
    }

    const decimals = field.decimals === undefined ? 2 : field.decimals!;

    if (showThresholdMarkers) {
      min = +min.toFixed(decimals);
      max = +max.toFixed(decimals);
    }

    const options = {
      series: {
        gauges: {
          gauge: {
            min,
            max,
            neutralValue: field.custom?.neutral,
            background: { color: backgroundColor },
            border: { color: null },
            shadow: { show: false },
            width: gaugeWidth,
          },
          frame: { show: false },
          label: { show: false },
          layout: { margin: 0, thresholdWidth: 0, vMargin: 0 },
          cell: { border: { width: 0 } },
          threshold: {
            values: getFormattedThresholds(decimals, field, value, theme),
            label: {
              show: showThresholdLabels,
              margin: thresholdMarkersWidth + 1,
              font: { size: thresholdLabelFontSize },
            },
            show: showThresholdMarkers,
            width: thresholdMarkersWidth,
          },
          value: {
            color: value.color,
            formatter: () => {
              return text;
            },
            font: { size: fontSize, family: theme.typography.fontFamily },
          },
          show: true,
        },
      },
    };

    const plotSeries = {
      data: [[0, numeric]],
      label: value.title,
    };

    try {
      if (this.canvasElement) {
        $.plot(this.canvasElement, [plotSeries], options);
      }
    } catch (err) {
      console.error('Gauge rendering error', err, options, value);
    }
  }

  renderVisualization = () => {
    const { width, value, height, onClick, text } = this.props;
    const autoProps = calculateGaugeAutoProps(width, height, value.title);

    return (
      <>
        <div
          style={{ height: `${autoProps.gaugeHeight}px`, width: '100%' }}
          ref={(element) => (this.canvasElement = element)}
          onClick={onClick}
        />
        {autoProps.showLabel && (
          <div
            style={{
              textAlign: 'center',
              fontSize: text?.titleSize ?? autoProps.titleFontSize,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              position: 'relative',
              width: '100%',
              top: '-4px',
              cursor: 'default',
            }}
          >
            {value.title}
          </div>
        )}
      </>
    );
  };

  render() {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
        className={this.props.className}
      >
        {this.renderVisualization()}
      </div>
    );
  }
}
