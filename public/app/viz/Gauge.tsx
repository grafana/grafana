import React, { PureComponent } from 'react';
import $ from 'jquery';
import { withSize } from 'react-sizeme';
import { TimeSeriesVMs } from 'app/types';
import config from '../core/config';

interface Props {
  timeSeries: TimeSeriesVMs;
  minValue: number;
  maxValue: number;
  showThresholdMarkers?: boolean;
  thresholds?: number[];
  showThresholdLables?: boolean;
  size?: { width: number; height: number };
}

const colors = ['rgba(50, 172, 45, 0.97)', 'rgba(237, 129, 40, 0.89)', 'rgba(245, 54, 54, 0.9)'];

export class Gauge extends PureComponent<Props> {
  parentElement: any;
  canvasElement: any;

  static defaultProps = {
    minValue: 0,
    maxValue: 100,
    showThresholdMarkers: true,
    showThresholdLables: false,
    thresholds: [],
  };

  componentDidMount() {
    this.draw();
  }

  componentDidUpdate(prevProps: Props) {
    this.draw();
  }

  draw() {
    const { maxValue, minValue, showThresholdLables, size, showThresholdMarkers, timeSeries, thresholds } = this.props;

    const width = size.width;
    const height = size.height;
    const dimension = Math.min(width, height * 1.3);

    const backgroundColor = config.bootData.user.lightTheme ? 'rgb(230,230,230)' : 'rgb(38,38,38)';
    const fontColor = config.bootData.user.lightTheme ? 'rgb(38,38,38)' : 'rgb(230,230,230)';
    const fontScale = parseInt('80', 10) / 100;
    const fontSize = Math.min(dimension / 5, 100) * fontScale;
    const gaugeWidth = Math.min(dimension / 6, 60);
    const thresholdMarkersWidth = gaugeWidth / 5;
    const thresholdLabelFontSize = fontSize / 2.5;

    const formattedThresholds = [];

    thresholds.forEach((threshold, index) => {
      formattedThresholds.push({
        value: threshold,
        color: colors[index],
      });
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
              return Math.round(timeSeries[0].stats.avg);
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
      data: [[0, timeSeries[0].stats.avg]],
    };

    try {
      $.plot(this.canvasElement, [plotSeries], options);
    } catch (err) {
      console.log('Gauge rendering error', err, options, timeSeries);
    }
  }

  render() {
    const { height, width } = this.props.size;

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

export default withSize({ monitorHeight: true })(Gauge);
