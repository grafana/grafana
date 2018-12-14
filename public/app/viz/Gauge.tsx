import React, { PureComponent } from 'react';
import $ from 'jquery';
import { BasicGaugeColor, MappingType, RangeMap, Threshold, TimeSeriesVMs, ValueMap } from 'app/types';
import config from '../core/config';
import kbn from '../core/utils/kbn';

interface Props {
  baseColor: string;
  decimals: number;
  height: number;
  mappings: Array<RangeMap | ValueMap>;
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
}

export class Gauge extends PureComponent<Props> {
  canvasElement: any;

  static defaultProps = {
    baseColor: BasicGaugeColor.Green,
    maxValue: 100,
    mappings: [],
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

  formatWithMappings(mappings, value) {
    const valueMaps = mappings.filter(m => m.type === MappingType.ValueToText);
    const rangeMaps = mappings.filter(m => m.type === MappingType.RangeToText);

    const valueMap = valueMaps.map(mapping => {
      if (mapping.value && value === mapping.value) {
        return mapping.text;
      }
    })[0];

    const rangeMap = rangeMaps.map(mapping => {
      if (mapping.from && mapping.to && value > mapping.from && value < mapping.to) {
        return mapping.text;
      }
    })[0];

    return {
      rangeMap,
      valueMap,
    };
  }

  formatValue(value) {
    const { decimals, mappings, prefix, suffix, unit } = this.props;

    const formatFunc = kbn.valueFormats[unit];
    const formattedValue = formatFunc(value, decimals);

    if (mappings.length > 0) {
      const { rangeMap, valueMap } = this.formatWithMappings(mappings, formattedValue);

      if (valueMap) {
        return valueMap;
      } else if (rangeMap) {
        return rangeMap;
      }
    }

    if (isNaN(value)) {
      return '-';
    }

    return `${prefix} ${formattedValue} ${suffix}`;
  }

  getFontColor(value) {
    const { baseColor, thresholds } = this.props;

    if (thresholds.length > 0) {
      const foo = thresholds.filter(t => value <= t.value);

      if (foo.length > 0) {
        return foo[0].color;
      }
    }

    return baseColor;
  }

  draw() {
    const {
      baseColor,
      maxValue,
      minValue,
      timeSeries,
      showThresholdLabels,
      showThresholdMarkers,
      thresholds,
      width,
      height,
      stat,
    } = this.props;

    let value: string | number = '';

    if (timeSeries[0]) {
      value = timeSeries[0].stats[stat];
    } else {
      value = 'N/A';
    }

    const dimension = Math.min(width, height * 1.3);
    const backgroundColor = config.bootData.user.lightTheme ? 'rgb(230,230,230)' : 'rgb(38,38,38)';
    const fontScale = parseInt('80', 10) / 100;
    const fontSize = Math.min(dimension / 5, 100) * fontScale;
    const gaugeWidthReduceRatio = showThresholdLabels ? 1.5 : 1;
    const gaugeWidth = Math.min(dimension / 6, 60) / gaugeWidthReduceRatio;
    const thresholdMarkersWidth = gaugeWidth / 5;
    const thresholdLabelFontSize = fontSize / 2.5;

    const formattedThresholds = [
      { value: minValue, color: BasicGaugeColor.Green },
      ...thresholds.map((threshold, index) => {
        return {
          value: threshold.value,
          // Hacky way to get correct color for threshold.
          color: index === 0 ? threshold.color : thresholds[index - 1].color,
        };
      }),
      {
        value: maxValue,
        color: thresholds.length > 0 ? BasicGaugeColor.Red : baseColor,
      },
    ];

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
            values: formattedThresholds,
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
              return this.formatValue(value);
            },
            font: {
              size: fontSize,
              family: '"Helvetica Neue", Helvetica, Arial, sans-serif',
            },
          },
          show: true,
        },
      },
    };

    const plotSeries = {
      data: [[0, value]],
    };

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
