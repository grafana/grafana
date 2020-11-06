import React, { PureComponent } from 'react';
import $ from 'jquery';
import {
  DisplayValue,
  formattedValueToString,
  FieldConfig,
  ThresholdsMode,
  getActiveThreshold,
  Threshold,
  getColorForTheme,
  FieldColorModeId,
  FALLBACK_COLOR,
} from '@grafana/data';
import { Themeable } from '../../types';
import { calculateFontSize } from '../../utils/measureText';

export interface Props extends Themeable {
  height: number;
  field: FieldConfig;
  showThresholdMarkers: boolean;
  showThresholdLabels: boolean;
  width: number;
  value: DisplayValue;
  onClick?: React.MouseEventHandler<HTMLElement>;
  className?: string;
}

export class Gauge extends PureComponent<Props> {
  canvasElement: any;

  static defaultProps: Partial<Props> = {
    showThresholdMarkers: true,
    showThresholdLabels: false,
    field: {
      min: 0,
      max: 100,
      thresholds: {
        mode: ThresholdsMode.Absolute,
        steps: [
          { value: -Infinity, color: 'green' },
          { value: 80, color: 'red' },
        ],
      },
    },
  };

  componentDidMount() {
    this.draw();
  }

  componentDidUpdate() {
    this.draw();
  }

  getFormattedThresholds(decimals: number): Threshold[] {
    const { field, theme, value } = this.props;

    if (field.color?.mode !== FieldColorModeId.Thresholds) {
      return [{ value: field.min ?? 0, color: value.color ?? FALLBACK_COLOR }];
    }

    const thresholds = field.thresholds ?? Gauge.defaultProps.field?.thresholds!;
    const isPercent = thresholds.mode === ThresholdsMode.Percentage;
    const steps = thresholds.steps;
    let min = field.min!;
    let max = field.max!;

    if (isPercent) {
      min = 0;
      max = 100;
    }

    const first = getActiveThreshold(min, steps);
    const last = getActiveThreshold(max, steps);
    const formatted: Threshold[] = [];
    formatted.push({ value: +min.toFixed(decimals), color: getColorForTheme(first.color, theme) });
    let skip = true;
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (skip) {
        if (first === step) {
          skip = false;
        }
        continue;
      }
      const prev = steps[i - 1];
      formatted.push({ value: step.value, color: getColorForTheme(prev!.color, theme) });
      if (step === last) {
        break;
      }
    }
    formatted.push({ value: +max.toFixed(decimals), color: getColorForTheme(last.color, theme) });
    return formatted;
  }

  draw() {
    const { field, showThresholdLabels, showThresholdMarkers, width, height, theme, value } = this.props;

    const autoProps = calculateGaugeAutoProps(width, height, value.title);
    const dimension = Math.min(width, autoProps.gaugeHeight);
    const backgroundColor = theme.colors.bg2;
    const gaugeWidthReduceRatio = showThresholdLabels ? 1.5 : 1;
    const gaugeWidth = Math.min(dimension / 5.5, 40) / gaugeWidthReduceRatio;
    const thresholdMarkersWidth = gaugeWidth / 5;
    const text = formattedValueToString(value);
    // This not 100% accurate as I am unsure of flot's calculations here
    const valueWidthBase = Math.min(width, dimension * 1.3) * 0.9;
    // remove gauge & marker width (on left and right side)
    // and 10px is some padding that flot adds to the outer canvas
    const valueWidth = valueWidthBase - ((gaugeWidth + (showThresholdMarkers ? thresholdMarkersWidth : 0)) * 2 + 10);
    const fontSize = calculateFontSize(text, valueWidth, dimension, 1, 48);
    const thresholdLabelFontSize = fontSize / 2.5;

    let min = field.min!;
    let max = field.max!;
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

    const options: any = {
      series: {
        gauges: {
          gauge: {
            min,
            max,
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
            values: this.getFormattedThresholds(decimals),
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
            font: { size: fontSize, family: theme.typography.fontFamily.sansSerif },
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
      $.plot(this.canvasElement, [plotSeries], options);
    } catch (err) {
      console.error('Gauge rendering error', err, options, value);
    }
  }

  renderVisualization = () => {
    const { width, value, height, onClick } = this.props;
    const autoProps = calculateGaugeAutoProps(width, height, value.title);

    return (
      <>
        <div
          style={{ height: `${autoProps.gaugeHeight}px`, width: '100%' }}
          ref={element => (this.canvasElement = element)}
          onClick={onClick}
        />
        {autoProps.showLabel && (
          <div
            style={{
              textAlign: 'center',
              fontSize: autoProps.titleFontSize,
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

interface GaugeAutoProps {
  titleFontSize: number;
  gaugeHeight: number;
  showLabel: boolean;
}

function calculateGaugeAutoProps(width: number, height: number, title: string | undefined): GaugeAutoProps {
  const showLabel = title !== null && title !== undefined;
  const titleFontSize = Math.min((width * 0.15) / 1.5, 20); // 20% of height * line-height, max 40px
  const titleHeight = titleFontSize * 1.5;
  const availableHeight = showLabel ? height - titleHeight : height;
  const gaugeHeight = Math.min(availableHeight, width);

  return {
    showLabel,
    gaugeHeight,
    titleFontSize,
  };
}
