import React, { PureComponent } from 'react';
import * as d3 from 'd3';

import { GrafanaThemeType } from '../../types';
import { Themeable } from '../../index';

export enum PiechartType {
  PIE = 'pie',
  DONUT = 'donut',
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
  containerElement: any;

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
    const names = datapoints.map(datapoint => datapoint.name);
    const colors = datapoints.map(datapoint => datapoint.color);

    const width = this.containerElement.offsetWidth;
    const height = this.containerElement.offsetHeight;
    const radius = Math.min(width, height) / 2;

    const outerRadius = radius - radius / 10;
    const innerRadius = pieType === PiechartType.PIE ? 0 : radius - radius / 3;

    d3.select('.piechart-container svg').remove();
    const svg = d3
      .select('.piechart-container')
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('class', 'shadow')
      .append('g')
      .attr('transform', `translate(${width / 2},${height / 2})`);

    const arc = d3
      .arc()
      .outerRadius(outerRadius)
      .innerRadius(innerRadius)
      .padAngle(0);

    const pie = d3.pie();

    svg
      .selectAll('path')
      .data(pie(data))
      .enter()
      .append('path')
      .attr('d', arc as any)
      .attr('fill', (d: any, idx: number) => {
        return colors[idx];
      })
      .style('fill-opacity', 0.15)
      .style('stroke', (d: any, idx: number) => {
        return colors[idx];
      })
      .style('stroke-width', `${strokeWidth}px`)
      .on('mouseover', (d: any, idx: any) => {
        d3.select('#tooltip')
          .style('opacity', 1)
          .select('#tooltip-value')
          // TODO: show percents
          .text(`${names[idx]} (${data[idx]})`);
      })
      .on('mousemove', () => {
        d3.select('#tooltip')
          .style('top', d3.event.pageY - 10 + 'px')
          .style('left', d3.event.pageX + 10 + 'px');
      })
      .on('mouseout', () => {
        d3.select('#tooltip').style('opacity', 0);
      });
  }

  render() {
    const { height, width } = this.props;

    return (
      <div className="piechart-panel">
        <div
          ref={element => (this.containerElement = element)}
          className="piechart-container"
          style={{
            height: `${height * 0.9}px`,
            width: `${Math.min(width, height * 1.3)}px`,
            top: '10px',
            margin: 'auto',
          }}
        />
        <div id="tooltip" className="piechart-tooltip">
          <div className="piechart-tooltip-time">
            <div id="tooltip-value" className="piechart-tooltip-value" />
          </div>
        </div>
      </div>
    );
  }
}

export default Piechart;
