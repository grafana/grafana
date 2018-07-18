import $ from 'jquery';
import 'vendor/flot/jquery.flot';
import React from 'react';
import { SeriesStat, MultistatPanelSize } from '../types';
import { getBGColor } from './utils';

export interface Props {
  stat: SeriesStat;
  size: MultistatPanelSize;
  options: any;
  color?: string;
}

export class SparkLine extends React.Component<Props> {
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
    const width = this.props.size.w - 10;
    const height = this.props.size.h;
    if (width <= 0 || height <= 0) {
      return;
    }

    let plotCss: any = {};
    plotCss.position = 'absolute';

    plotCss.bottom = '5px';
    plotCss.left = '5px';
    plotCss.width = width - 10 + 'px';
    // const dynamicHeightMargin = height <= 100 ? 5 : Math.round(height / 100) * 15 + 5;
    // plotCss.height = height - dynamicHeightMargin + 'px';
    plotCss.height = height + 'px';

    const flotpairs = this.props.stat.flotpairs;
    const timeRange = {
      from: flotpairs[0][0],
      to: flotpairs[flotpairs.length - 1][0],
    };

    const fillColor = this.props.color ? getBGColor(this.props.color, 0.1) : this.props.options.sparkline.fillColor;
    const lineColor = this.props.color || this.props.options.sparkline.lineColor;

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
    return <div ref={elem => (this.elem = elem)} />;
  }
}
