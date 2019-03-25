import React, { PureComponent } from 'react';
import { select, pie, arc, event } from 'd3';
import { sum } from 'lodash';

import { GrafanaThemeType, DisplayValue } from '../../types';
import { Themeable } from '../../index';
import { colors as grafana_colors } from '../../utils/index';

export enum PieChartType {
  PIE = 'pie',
  DONUT = 'donut',
}

export interface Props extends Themeable {
  height: number;
  width: number;
  values: DisplayValue[];

  pieType: PieChartType;
  strokeWidth: number;
}

export class PieChart extends PureComponent<Props> {
  containerElement: any;
  svgElement: any;
  tooltipElement: any;
  tooltipValueElement: any;

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
    const { values, pieType, strokeWidth } = this.props;

    if (values.length === 0) {
      return;
    }

    const data = values.map(datapoint => datapoint.numeric);
    const names = values.map(datapoint => datapoint.text);
    const colors = values.map((p, idx) => {
      if (p.color) {
        return p.color;
      }
      return grafana_colors[idx % grafana_colors.length];
    });

    const total = sum(data) || 1;
    const percents = data.map((item: number) => (item / total) * 100);

    const width = this.containerElement.offsetWidth;
    const height = this.containerElement.offsetHeight;
    const radius = Math.min(width, height) / 2;

    const outerRadius = radius - radius / 10;
    const innerRadius = pieType === PieChartType.PIE ? 0 : radius - radius / 3;

    const svg = select(this.svgElement)
      .html('')
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${width / 2},${height / 2})`);

    const pieChart = pie();

    const customArc = arc()
      .outerRadius(outerRadius)
      .innerRadius(innerRadius)
      .padAngle(0);

    svg
      .selectAll('path')
      .data(pieChart(data))
      .enter()
      .append('path')
      .attr('d', customArc as any)
      .attr('fill', (d: any, idx: number) => colors[idx])
      .style('fill-opacity', 0.15)
      .style('stroke', (d: any, idx: number) => colors[idx])
      .style('stroke-width', `${strokeWidth}px`)
      .on('mouseover', (d: any, idx: any) => {
        select(this.tooltipElement).style('opacity', 1);
        select(this.tooltipValueElement).text(`${names[idx]} (${percents[idx].toFixed(2)}%)`);
      })
      .on('mousemove', () => {
        select(this.tooltipElement)
          .style('top', `${event.pageY - height / 2}px`)
          .style('left', `${event.pageX}px`);
      })
      .on('mouseout', () => {
        select(this.tooltipElement).style('opacity', 0);
      });
  }

  render() {
    const { height, width, values } = this.props;

    if (values.length > 0) {
      return (
        <div className="piechart-panel">
          <div
            ref={element => (this.containerElement = element)}
            className="piechart-container"
            style={{
              height: `${height * 0.9}px`,
              width: `${Math.min(width, height * 1.3)}px`,
            }}
          >
            <svg ref={element => (this.svgElement = element)} />
          </div>
          <div className="piechart-tooltip" ref={element => (this.tooltipElement = element)}>
            <div className="piechart-tooltip-time">
              <div
                id="tooltip-value"
                className="piechart-tooltip-value"
                ref={element => (this.tooltipValueElement = element)}
              />
            </div>
          </div>
        </div>
      );
    } else {
      return (
        <div className="piechart-panel">
          <div className="datapoints-warning">
            <span className="small">No data points</span>
          </div>
        </div>
      );
    }
  }
}
