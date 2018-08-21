import $ from 'jquery';
import 'vendor/flot/jquery.flot';
import React from 'react';
import * as Flot from 'app/types/flot';
import * as Series from 'app/types/series';
import * as MultiStatPanel from '../types';

export interface SparkLineProps {
  flotpairs: Series.Flotpair[];
  size: MultiStatPanel.PanelSize;
  color?: string;
  fill?: number;
  fillColor?: string;
  lineColor?: string;
  lineWidth?: number;
  customClass?: string;
  customStyles?: any;
}

const defaultSparkLineProps: Partial<SparkLineProps> = {
  color: 'rgb(31, 120, 193)',
  fill: 0.1,
  fillColor: '',
  lineColor: '',
  lineWidth: 1,
  customClass: '',
  customStyles: '',
};

export class SparkLine extends React.Component<SparkLineProps> {
  elem: any;
  $elem: any;
  plot: any;

  static defaultProps = defaultSparkLineProps;

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
    const lineColor = this.props.lineColor || this.props.color;

    if (width <= 0 || height <= 0 || !flotpairs) {
      this.$elem.empty();
      return;
    }

    const timeRange = {
      from: flotpairs[0][0],
      to: flotpairs[flotpairs.length - 1][0],
    };

    const sparklineOptions: Flot.FlotOptions = {
      legend: { show: false },
      series: {
        lines: {
          show: true,
          fill: this.props.fill,
          zero: false,
          lineWidth: this.props.lineWidth,
          fillColor: this.props.fillColor,
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

    const plotCss: any = {
      width: width + 'px',
      height: height + 'px',
      ...this.props.customStyles,
    };

    const plotSeries = {
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
