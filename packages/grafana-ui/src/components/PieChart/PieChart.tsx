import React, { FC, useEffect, useRef, useState } from 'react';
import { select, pie, arc, event } from 'd3';
import sum from 'lodash/sum';
import { DisplayValue, formattedValueToString, getColorFromHexRgbOrName } from '@grafana/data';
import { useTheme } from '../../themes/ThemeContext';
import tinycolor from 'tinycolor2';
import Pie, { ProvidedProps, PieArcDatum } from '@visx/shape/lib/shapes/Pie';
import { scaleOrdinal } from '@visx/scale';
import { Group } from '@visx/group';
import { GradientPinkBlue } from '@visx/gradient';
import { animated, useTransition, interpolate } from 'react-spring';

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

const margin = { top: 20, right: 20, bottom: 20, left: 20 };
const getValue = (d: DisplayValue) => d.numeric;

export const PieChart: FC<Props> = ({ values, pieType, width, height }) => {
  const theme = useTheme();

  if (values.length < 0) {
    return <div>No data</div>;
  }

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const radius = Math.min(innerWidth, innerHeight) / 2;
  const centerY = innerHeight / 2;
  const centerX = innerWidth / 2;
  const donutThickness = 50;
  const animate = true;

  return (
    <svg width={width} height={height}>
      <GradientPinkBlue id="visx-pie-gradient" />
      <rect rx={14} width={width} height={height} fill="url('#visx-pie-gradient')" />
      <Group top={centerY + margin.top} left={centerX + margin.left}>
        <Pie
          data={values}
          pieValue={getValue}
          outerRadius={radius}
          innerRadius={radius - donutThickness}
          cornerRadius={3}
          padAngle={0.005}
        >
          {pie => (
            <AnimatedPie<DisplayValue>
              {...pie}
              animate={animate}
              getKey={arc => arc.data.title!}
              getColor={arc => arc.data.color!}
            />
          )}
        </Pie>
      </Group>
    </svg>
  );
};

// react-spring transition definitions
type AnimatedStyles = { startAngle: number; endAngle: number; opacity: number };

const fromLeaveTransition = ({ endAngle }: PieArcDatum<any>) => ({
  // enter from 360° if end angle is > 180°
  startAngle: endAngle > Math.PI ? 2 * Math.PI : 0,
  endAngle: endAngle > Math.PI ? 2 * Math.PI : 0,
  opacity: 0,
});

const enterUpdateTransition = ({ startAngle, endAngle }: PieArcDatum<any>) => ({
  startAngle,
  endAngle,
  opacity: 1,
});

type AnimatedPieProps<Datum> = ProvidedProps<Datum> & {
  animate?: boolean;
  getKey: (d: PieArcDatum<Datum>) => string;
  getColor: (d: PieArcDatum<Datum>) => string;
  // onClickDatum: (d: PieArcDatum<Datum>) => void;
  delay?: number;
};

function AnimatedPie<Datum>({ animate, arcs, path, getKey, getColor }: AnimatedPieProps<Datum>) {
  const transitions = useTransition<PieArcDatum<Datum>, AnimatedStyles>(
    arcs,
    getKey,
    // @ts-ignore react-spring doesn't like this overload
    {
      from: animate ? fromLeaveTransition : enterUpdateTransition,
      enter: enterUpdateTransition,
      update: enterUpdateTransition,
      leave: animate ? fromLeaveTransition : enterUpdateTransition,
    }
  );
  return (
    <>
      {transitions.map(
        ({ item: arc, props, key }: { item: PieArcDatum<Datum>; props: AnimatedStyles; key: string }) => {
          const [centroidX, centroidY] = path.centroid(arc);
          const hasSpaceForLabel = arc.endAngle - arc.startAngle >= 0.1;

          return (
            <g key={key}>
              <animated.path
                // compute interpolated path d attribute from intermediate angle values
                d={interpolate([props.startAngle, props.endAngle], (startAngle, endAngle) =>
                  path({
                    ...arc,
                    startAngle,
                    endAngle,
                  })
                )}
                fill={getColor(arc)}
                //onClick={() => onClickDatum(arc)}
                //onTouchStart={() => onClickDatum(arc)}
              />
              {hasSpaceForLabel && (
                <animated.g style={{ opacity: props.opacity }}>
                  <text
                    fill="white"
                    x={centroidX}
                    y={centroidY}
                    dy=".33em"
                    fontSize={9}
                    textAnchor="middle"
                    pointerEvents="none"
                  >
                    {getKey(arc)}
                  </text>
                </animated.g>
              )}
            </g>
          );
        }
      )}
    </>
  );
}

// {
/*
  
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
  <div className="piechart-tooltip" ref={element => (this.tooltipElement = element)}>
        <div className="piechart-tooltip-time">
          <div
            id="tooltip-value"
            className="piechart-tooltip-value"
            ref={element => (this.tooltipValueElement = element)}
          />
        </div>
      </div> */
//}
