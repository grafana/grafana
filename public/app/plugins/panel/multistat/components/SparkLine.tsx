import $ from 'jquery';
import 'vendor/flot/jquery.flot';
import React from 'react';
import * as Series from 'app/types/series';
import * as MultiStatPanel from '../types';
import { getBGColor } from './utils';

export interface SparkLineProps {
  flotpairs: Series.Flotpair[];
  size: MultiStatPanel.PanelSize;
  color: string;
  fillColor?: string;
  lineColor?: string;
  customClass?: string;
  customStyles?: any;
}

export class SparkLine extends React.Component<SparkLineProps> {
  elem: any;
  $elem: any;
  plot: any;

  constructor(props) {
    super(props);
  }

  componentDidMount() {
    this.$elem = $(this.elem);
    this.forceUpdate();
  }

  componentDidUpdate(prevProps) {
    const { size, flotpairs } = this.props;
    const width = size.w;
    const height = size.h;

    if (width <= 0 || height <= 0 || !flotpairs) {
      this.$elem.empty();
      return;
    }

    let plotCss: any = { ...this.props.customStyles };
    plotCss.width = width + 'px';
    plotCss.height = height + 'px';

    const timeRange = {
      from: flotpairs[0][0],
      to: flotpairs[flotpairs.length - 1][0],
    };

    const fillColor = this.props.fillColor || getBGColor(this.props.color, 0.1);
    const lineColor = this.props.lineColor || this.props.color;

    let sparklineOptions = {
      legend: { show: false },
      series: {
        lines: {
          show: true,
          fill: 1,
          zero: false,
          lineWidth: 1,
          fillColor: fillColor,
        },
      },
      yaxes: { show: false },
      xaxis: {
        show: false,
        mode: 'time',
        min: timeRange.from,
        max: timeRange.to,
      },
      grid: { hoverable: false, show: false },
    };

    let plotSeries = {
      data: flotpairs,
      color: lineColor,
    };

    this.$elem.empty();
    this.$elem.css(plotCss);
    this.plot = $.plot(this.$elem, [plotSeries], sparklineOptions);
  }

  componentWillUnmount() {
    if (this.plot) {
      // this.plot.destroy();
    }
  }

  render() {
    const className = `${this.props.customClass || ''}`;
    return <div className={className} ref={elem => (this.elem = elem)} />;
  }
}
