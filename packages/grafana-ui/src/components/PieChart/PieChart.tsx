import React, { FC, useEffect, useRef } from 'react';
import { select, pie, arc, event } from 'd3';
import sum from 'lodash/sum';
import { DisplayValue, formattedValueToString, getColorFromHexRgbOrName } from '@grafana/data';
import { useTheme } from '../../themes/ThemeContext';
import tinycolor from 'tinycolor2';

export enum PieChartType {
  Pie = 'pie',
  Donut = 'donut',
}

export interface Props {
  height: number;
  width: number;
  values: DisplayValue[];
  pieType: PieChartType;
}

export const PieChart: FC<Props> = ({ values, pieType, width, height }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const theme = useTheme();

  useEffect(() => {
    if (values.length === 0) {
      return;
    }

    if (!svgRef.current) {
      return;
    }

    const svgElement = svgRef.current!;

    const data = values.map(datapoint => datapoint.numeric);
    const colors = ['blue', 'green', 'red', 'purple', 'orange'].map(c => getColorFromHexRgbOrName(c, theme.type));
    const strokeColor = theme.colors.panelBg;
    const themeFactor = theme.isDark ? 1 : -0.7;
    const total = sum(data) || 1;

    // const names = values.map(datapoint => formattedValueToString(datapoint));
    // const percents = data.map((item: number) => (item / total) * 100);
    // const width = svgRef.offsetWidth;
    // const height = svgRef.offsetHeight;

    const radius = Math.min(width, height) / 2;
    const outerRadius = radius - radius / 10;
    const innerRadius = pieType === PieChartType.Pie ? 0 : radius - radius / 3;
    const gradientStart = pieType === PieChartType.Donut ? 0.7 : 0;

    const svg = select(svgElement)
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

    const defs = svg.append('defs');

    for (let idx = 0; idx < values.length; idx++) {
      const seriesColor = colors[idx];
      const fillGradient = defs.append('radialGradient');
      fillGradient.attr('id', `fillGradient-${idx}`);
      fillGradient.attr('gradientUnits', 'userSpaceOnUse');
      fillGradient.attr('cx', 0);
      fillGradient.attr('cy', 0);
      fillGradient.attr('r', outerRadius);

      const bgColor2 = tinycolor(seriesColor)
        .darken(15 * themeFactor)
        .spin(8)
        .toRgbString();

      const bgColor3 = tinycolor(seriesColor)
        .darken(5 * themeFactor)
        .spin(-8)
        .toRgbString();

      fillGradient
        .append('stop')
        .attr('offset', gradientStart)
        .attr('stop-color', bgColor2);
      +fillGradient
        .append('stop')
        .attr('offset', '1')
        .attr('stop-color', bgColor3);
    }

    svg
      .selectAll('path')
      .data(pieChart(data))
      .enter()
      .append('path')
      .attr('d', customArc as any)
      .attr('fill', (d: any, idx: number) => `url(#fillGradient-${idx})`)
      .style('stroke', (d: any, idx: number) => strokeColor)
      .style('stroke-width', `2px`)
      .style('fill-opacity', 0.9)
      .on('mouseover', function(d: any, idx: any) {
        select(this).style('fill-opacity', 1.0);
        // select(this.tooltipElement).style('opacity', 1);
        // select(this.tooltipValueElement).text(`${names[idx]} (${percents[idx].toFixed(2)}%)`);
      })
      .on('mouseout', function() {
        select(this).style('fill-opacity', 0.9);
        // select(this.tooltipElement)
        //   .style('top', `${event.pageY - height / 2}px`)
        //   .style('left', `${event.pageX}px`);
      });
    // .on('mouseout', () => {
    //   select(this.tooltipElement).style('opacity', 0);
    // });
  });

  if (values.length === 0) {
    return (
      <div className="piechart-panel">
        <div className="datapoints-warning">
          <span className="small">No data points</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <svg ref={svgRef} />
    </div>
  );
};

{
  /* <div className="piechart-tooltip" ref={element => (this.tooltipElement = element)}>
        <div className="piechart-tooltip-time">
          <div
            id="tooltip-value"
            className="piechart-tooltip-value"
            ref={element => (this.tooltipValueElement = element)}
          />
        </div>
      </div> */
}
