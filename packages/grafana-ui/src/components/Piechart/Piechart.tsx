import React, { PureComponent } from 'react';
import * as d3 from 'd3';

import { GrafanaThemeType } from '../../types';
import { Themeable } from '../../index';


export enum PiechartType {
  PIE = 'pie',
  DONUT = 'donut'
}

export interface PiechartDataPoint {
  value: number;
  name: string;
  color: string;
}

export interface Props extends Themeable {
  height: number;
  width: number;
  datapoints: PiechartDataPoint[];

  unit: string;
  pieType: PiechartType;
  strokeWidth: number;
}

export class Piechart extends PureComponent<Props> {
  canvasElement: any;

  static defaultProps = {
    pieType: 'pie',
    format: 'short',
    stat: 'current',
    strokeWidth: 1,
    theme: GrafanaThemeType.Dark,
  };

  componentDidMount() {
    this.draw();
  }

  componentDidUpdate() {
    this.draw();
  }

  draw() {
    const { datapoints, pieType, strokeWidth } = this.props;

    const data = datapoints.map(datapoint => datapoint.value);
    const colors = datapoints.map(datapoint => datapoint.color);

    const width = this.canvasElement.width;
    const height = this.canvasElement.height;
    const radius = Math.min(width, height) / 2;

    const innerRadius = pieType === PiechartType.PIE? 0: radius;

    const context = this.canvasElement.getContext('2d');
    context.translate(width / 2, height / 2);
    context.globalAlpha = 0.5;

    const pie = d3.pie();

    const arcs = pie(data);
    const arc = d3.arc()
      .outerRadius(radius - 10)
      .innerRadius(innerRadius)
      .padAngle(0.03)
      .context(context);

    arcs.forEach((d, idx) => {
      context.beginPath();
      arc(d as any);
      context.fillStyle = colors[idx];
      context.fill();
    });

    context.globalAlpha = 1;
    context.beginPath();
    arcs.forEach(arc as any);
    context.lineWidth = strokeWidth;
    context.stroke();
  }

  render() {
    const { height, width } = this.props;

    return (
      <div className="piechart-panel">
        <div
          style={{
            height: `${height * 0.9}px`,
            width: `${Math.min(width, height * 1.3)}px`,
            top: '10px',
            margin: 'auto',
          }}
        >
          <canvas ref={element => (this.canvasElement = element)} />
        </div>
      </div>
    );
  }
}

export default Piechart;
