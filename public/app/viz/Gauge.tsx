import React, { PureComponent } from 'react';
import $ from 'jquery';
import { TimeSeriesVMs } from 'app/types';
import config from '../core/config';
import kbn from '../core/utils/kbn';

interface Props {
  decimals: number;
  timeSeries: TimeSeriesVMs;
  minValue?: number;
  maxValue?: number;
  showThresholdMarkers?: boolean;
  thresholds?: number[];
  showThresholdLables?: boolean;
  unit: string;
  width: number;
  height: number;
  stat?: string;
  prefix: string;
  sufix: string;
}

const colors = ['rgba(50, 172, 45, 0.97)', 'rgba(237, 129, 40, 0.89)', 'rgba(245, 54, 54, 0.9)'];

export class Gauge extends PureComponent<Props> {
  parentElement: any;
  canvasElement: any;

  static defaultProps = {
    minValue: 0,
    maxValue: 100,
    prefix: '',
    showThresholdMarkers: true,
    showThresholdLables: false,
    sufix: '',
    thresholds: [0, 100],
  };

  componentDidMount() {
    this.draw();
  }

  componentDidUpdate(prevProps: Props) {
    this.draw();
  }

  formatValue(value) {
    const { decimals, prefix, sufix, unit } = this.props;

    const formatFunc = kbn.valueFormats[unit];
    return `${prefix} ${formatFunc(value, decimals)} ${sufix}`;
  }

  draw() {
    const {
      timeSeries,
      maxValue,
      minValue,
      showThresholdLables,
      showThresholdMarkers,
      thresholds,
      width,
      height,
      stat,
    } = this.props;

    const dimension = Math.min(width, height * 1.3);
    const backgroundColor = config.bootData.user.lightTheme ? 'rgb(230,230,230)' : 'rgb(38,38,38)';
    const fontColor = config.bootData.user.lightTheme ? 'rgb(38,38,38)' : 'rgb(230,230,230)';
    const fontScale = parseInt('80', 10) / 100;
    const fontSize = Math.min(dimension / 5, 100) * fontScale;
    const gaugeWidth = Math.min(dimension / 6, 60);
    const thresholdMarkersWidth = gaugeWidth / 5;
    const thresholdLabelFontSize = fontSize / 2.5;

    const formattedThresholds = thresholds.map((threshold, index) => {
      return {
        value: threshold,
        color: colors[index],
      };
    });

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
              show: showThresholdLables,
              margin: thresholdMarkersWidth + 1,
              font: { size: thresholdLabelFontSize },
            },
            show: showThresholdMarkers,
            width: thresholdMarkersWidth,
          },
          value: {
            color: fontColor,
            formatter: () => {
              if (timeSeries[0]) {
                return this.formatValue(timeSeries[0].stats[stat]);
              }

              return '';
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

    let value: string | number = 'N/A';
    if (timeSeries.length) {
      value = timeSeries[0].stats.avg;
    }

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
      <div className="singlestat-panel" ref={element => (this.parentElement = element)}>
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
