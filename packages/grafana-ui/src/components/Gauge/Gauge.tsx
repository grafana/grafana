import React, { PureComponent } from 'react';
import $ from 'jquery';

import {
  ValueMapping,
  Threshold,
  Theme,
  MappingType,
  BasicGaugeColor,
  Themes,
  ValueMap,
  RangeMap,
} from '../../types/panel';
import { TimeSeriesVMs } from '../../types/series';
import { getValueFormat } from '../../utils/valueFormats/valueFormats';

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
  theme?: Theme;
}

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
  };

  componentDidMount() {
    this.draw();
  }

  componentDidUpdate() {
    this.draw();
  }

  addValueToTextMappingText(
    allTexts: Array<{ text: string; type: MappingType }>,
    valueToTextMapping: ValueMap,
    value: TimeSeriesValue
  ) {
    if (!valueToTextMapping.value) {
      return allTexts;
    }

    const valueAsNumber = parseFloat(value as string);
    const valueToTextMappingAsNumber = parseFloat(valueToTextMapping.value as string);

    if (isNaN(valueAsNumber) || isNaN(valueToTextMappingAsNumber)) {
      return allTexts;
    }

    if (valueAsNumber !== valueToTextMappingAsNumber) {
      return allTexts;
    }

    return allTexts.concat({ text: valueToTextMapping.text, type: MappingType.ValueToText });
  }

  addRangeToTextMappingText(
    allTexts: Array<{ text: string; type: MappingType }>,
    rangeToTextMapping: RangeMap,
    value: TimeSeriesValue
  ) {
    if (
      rangeToTextMapping.from &&
      rangeToTextMapping.to &&
      value &&
      value >= rangeToTextMapping.from &&
      value <= rangeToTextMapping.to
    ) {
      return allTexts.concat({ text: rangeToTextMapping.text, type: MappingType.RangeToText });
    }

    return allTexts;
  }

  getAllMappingTexts(valueMappings: ValueMapping[], value: TimeSeriesValue) {
    const allMappingTexts = valueMappings.reduce(
      (allTexts, valueMapping) => {
        if (valueMapping.type === MappingType.ValueToText) {
          allTexts = this.addValueToTextMappingText(allTexts, valueMapping as ValueMap, value);
        } else if (valueMapping.type === MappingType.RangeToText) {
          allTexts = this.addRangeToTextMappingText(allTexts, valueMapping as RangeMap, value);
        }

        return allTexts;
      },
      [] as Array<{ text: string; type: MappingType }>
    );

    allMappingTexts.sort((t1, t2) => {
      return t1.type - t2.type;
    });

    return allMappingTexts;
  }

  formatWithValueMappings(valueMappings: ValueMapping[], value: TimeSeriesValue) {
    return this.getAllMappingTexts(valueMappings, value)[0];
  }

  formatValue(value: TimeSeriesValue) {
    const { decimals, valueMappings, prefix, suffix, unit } = this.props;

    if (isNaN(value as number)) {
      return value;
    }

    if (valueMappings.length > 0) {
      const valueMappedValue = this.formatWithValueMappings(valueMappings, value);
      if (valueMappedValue) {
        return `${prefix} ${valueMappedValue.text} ${suffix}`;
      }
    }

    const formatFunc = getValueFormat(unit);
    const formattedValue = formatFunc(value as number, decimals);

    return `${prefix} ${formattedValue} ${suffix}`;
  }

  getFontColor(value: TimeSeriesValue) {
    const { thresholds } = this.props;

    if (thresholds.length === 1) {
      return thresholds[0].color;
    }

    const atThreshold = thresholds.filter(threshold => (value as number) < threshold.value);

    if (atThreshold.length > 0) {
      const nearestThreshold = atThreshold.sort((t1, t2) => t1.value - t2.value)[0];
      return nearestThreshold.color;
    }

    return BasicGaugeColor.Red;
  }

  draw() {
    const {
      maxValue,
      minValue,
      timeSeries,
      showThresholdLabels,
      showThresholdMarkers,
      thresholds,
      width,
      height,
      stat,
      theme,
    } = this.props;

    let value: TimeSeriesValue = '';

    if (timeSeries[0]) {
      value = timeSeries[0].stats[stat];
    } else {
      value = 'N/A';
    }

    const dimension = Math.min(width, height * 1.3);
    const backgroundColor = theme === Themes.Light ? 'rgb(230,230,230)' : 'rgb(38,38,38)';
    const fontScale = parseInt('80', 10) / 100;
    const fontSize = Math.min(dimension / 5, 100) * fontScale;
    const gaugeWidthReduceRatio = showThresholdLabels ? 1.5 : 1;
    const gaugeWidth = Math.min(dimension / 6, 60) / gaugeWidthReduceRatio;
    const thresholdMarkersWidth = gaugeWidth / 5;
    const thresholdLabelFontSize = fontSize / 2.5;

    const formattedThresholds = [
      { value: minValue, color: thresholds.length === 1 ? thresholds[0].color : BasicGaugeColor.Green },
      ...thresholds.map((threshold, index) => {
        return {
          value: threshold.value,
          color: thresholds[index].color,
        };
      }),
      { value: maxValue, color: thresholds.length === 1 ? thresholds[0].color : BasicGaugeColor.Red },
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
