import React, { PureComponent } from 'react';
import $ from 'jquery';
import { TimeSeriesVMs } from 'app/types';
import config from '../core/config';

interface Props {
  timeSeries: TimeSeriesVMs;
  minValue: number;
  maxValue: number;
  showThresholdMarkers?: boolean;
  thresholds?: number[];
  showThresholdLables?: boolean;
}

export class Gauge extends PureComponent<Props> {
  element: any;

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
    if (prevProps.timeSeries !== this.props.timeSeries) {
      this.draw();
    }
  }

  draw() {
    const { maxValue, minValue, showThresholdLables, showThresholdMarkers, timeSeries, thresholds } = this.props;

    console.log(timeSeries);
    const backgroundColor = config.bootData.user.lightTheme ? 'rgb(230,230,230)' : 'rgb(38,38,38)';
    const fontColor = config.bootData.user.lightTheme ? 'rgb(38,38,38)' : 'rgb(230,230,230)';

    const options = {
      series: {
        gauges: {
          gauge: {
            min: minValue,
            max: maxValue,
            background: { color: backgroundColor },
            border: { color: null },
            shadow: { show: false },
            width: '100%',
          },
          frame: { show: false },
          label: { show: false },
          layout: { margin: 0, thresholdWidth: 0 },
          cell: { border: { width: 0 } },
          threshold: {
            values: thresholds,
            label: {
              show: showThresholdLables,
              margin: 2,
              font: { size: 14 },
            },
            show: showThresholdMarkers,
            width: 1,
          },
          value: {
            color: fontColor,
            formatter: () => {
              return Math.round(timeSeries[0].stats.avg);
            },
            font: {
              size: 78,
              family: '"Helvetica Neue", Helvetica, Arial, sans-serif',
            },
          },
          show: true,
        },
      },
    };

    try {
      $.plot(this.element, timeSeries, options);
    } catch (err) {
      console.log('Gauge rendering error', err, options, timeSeries);
    }
  }

  getValueText() {}

  render() {
    return (
      <div className="singlestat-panel">
        <div className="graph-panel__chart" ref={e => (this.element = e)} />
      </div>
    );
  }
}
