import React from 'react';
import { FlotGraph, GraphProps } from './FlotGraph';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { number, boolean, select, color, date } from '@storybook/addon-knobs';

export default {
  title: 'Visualizations/FlotGraph/FlotGraph',
  component: FlotGraph,
  decorators: [withCenteredStory],
};

const dynamic = (boolName: string, boolDefault: boolean, knob: () => any, invert?: boolean, groupId?: string) => {
  const boolKnob = boolean(boolName, boolDefault, groupId);
  if ((invert && !boolKnob) || (!invert && boolKnob)) {
    return knob();
  } else {
    return null;
  }
};

const getProps = (): GraphProps => {
  const generalKnobs = 'General';
  const crosshairKnobs = 'Crosshair';
  const xaxisKnobs = 'X-Axis';
  const yaxisKnobs = 'Y-Axis';
  const gridKnobs = 'Grid';
  const selectionKnobs = 'Selection';
  const legendKnobs = 'Legend';

  const cosData: Array<[number, number]> = new Array(100)
    .fill(1)
    .map((_, i) => [1546372800000 + i * 10000, Math.cos((i / 100) * 2 * Math.PI)]);

  const sinData: Array<[number, number]> = new Array(100)
    .fill(1)
    .map((_, i) => [1546372800000 + i * 10000, Math.sin((i / 100) * 2 * Math.PI - Math.PI / 2)]);

  return {
    data: [
      {
        data: cosData,
        label: 'cos(x)',
      },
      {
        data: sinData,
        label: 'sin(y)',
      },
    ],
    width: number('Plot Width', 800, {}, generalKnobs),
    height: number('Plot Height', 500, {}, generalKnobs),

    crosshair: {
      mode: select('Mode', { Default: null, X: 'x', Y: 'y', XY: 'xy' }, null, crosshairKnobs),
      color: color('Color', '#ffffff', crosshairKnobs),
      lineWidth: number('Line Width', 1, {}, crosshairKnobs),
    },

    xaxis: {
      show: boolean('Show', true, xaxisKnobs),
      mode: 'time',
      position: select('Position', { Bottom: 'bottom', Top: 'top' }, 'bottom', xaxisKnobs),
      min: dynamic(
        'Automatic Minimum',
        true,
        () => date('Minimum', new Date(1546372800000), xaxisKnobs),
        true,
        xaxisKnobs
      ),
      max: dynamic(
        'Automatic Maximum',
        true,
        () => date('Maximum', new Date(1546380000000), xaxisKnobs),
        true,
        xaxisKnobs
      ),
    },

    yaxis: {
      show: boolean('Show', true, yaxisKnobs),
      position: select('Position', { Left: 'left', Right: 'right' }, 'left', yaxisKnobs),
      min: dynamic('Automatic Minimum', true, () => number('Minimum', 10, {}, yaxisKnobs), true, yaxisKnobs),
      max: dynamic('Automatic Maximum', true, () => number('Maximum', 22, {}, yaxisKnobs), true, yaxisKnobs),
    },

    grid: {
      show: boolean('Show', true, gridKnobs),
      aboveData: boolean('Above Data', false, gridKnobs),
      color: color('Color', '#C6C6C6', gridKnobs),
      backgroundColor: color('Background Color', '#000000', gridKnobs),
      margin: number('Margin', 1, {}, gridKnobs),
      labelMargin: number('Label Margin', 1, {}, gridKnobs),
      axisMargin: number('Axis Margin', 1, {}, gridKnobs),
      borderWidth: number('Border Width', 1, {}, gridKnobs),
      borderColor: color('Background Color', '#000000', gridKnobs),
      minBorderMargin: number('Min Border Margin', 1, {}, gridKnobs),
      // clickable: boolean('Clickable', false, gridKnobs),
      // hoverable: boolean('Hoverable', false, gridKnobs),
      // autoHighlight: boolean('Auto-Highlight', false, gridKnobs),
      // mouseActiveRadius: number('Mouse Active Radius', 5, {}, gridKnobs),
    },

    selection: {
      mode: select('Mode', { Default: null, X: 'x', Y: 'y', XY: 'xy' }, null, selectionKnobs),
      color: color('Color', '#e8cfac', selectionKnobs),
      shape: select('Shape', { Round: 'round', Miter: 'miter', Bevel: 'bevel' }, 'round', selectionKnobs),
      minSize: number('Min Size', 5, {}, selectionKnobs),
    },

    legend: {
      show: boolean('Show', true, legendKnobs),
      labelBoxBorderColor: color('Label Border Color', '#ffffff', legendKnobs),
      noColumns: number('No. Columns', 1, {}, legendKnobs),
      position: select('Position', { NE: 'ne', NW: 'nw', SE: 'se', SW: 'sw' }, 'ne', legendKnobs),
      backgroundColor: color('Background Color', '#ffffff', legendKnobs),
      backgroundOpacity: number('Background Opacity', 0.3, { range: true, min: 0, max: 1, step: 0.01 }, legendKnobs),
      margin: [number('X Margin', 5, {}, legendKnobs), number('Y Margin', 5, {}, legendKnobs)] as [number, number],
    },
  };
};

export const flotGraph = () => {
  const { data, width, height, xaxis, yaxis, crosshair, grid, selection, legend } = getProps();

  return (
    <FlotGraph
      data={data}
      width={width}
      height={height}
      xaxis={xaxis}
      yaxis={yaxis}
      crosshair={crosshair}
      grid={grid}
      selection={selection}
      legend={legend}
    />
  );
};
