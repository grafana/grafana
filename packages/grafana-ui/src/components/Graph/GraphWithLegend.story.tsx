import React from 'react';

import { select, text } from '@storybook/addon-knobs';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { GraphWithLegend, GraphWithLegendProps } from './GraphWithLegend';

import { LegendPlacement, LegendDisplayMode } from '../Legend/Legend';
import { GraphSeriesXY, FieldType, ArrayVector, dateTime, FieldColorModeId } from '@grafana/data';

export default {
  title: 'Visualizations/Graph',
  component: GraphWithLegend,
  decorator: [withCenteredStory],
};

const series: GraphSeriesXY[] = [
  {
    data: [
      [1546372800000, 10],
      [1546376400000, 20],
      [1546380000000, 10],
    ],
    color: 'red',
    isVisible: true,
    label: 'A-series',
    seriesIndex: 0,
    timeField: {
      type: FieldType.time,
      name: 'time',
      values: new ArrayVector([1546372800000, 1546376400000, 1546380000000]),
      config: {},
    },
    valueField: {
      type: FieldType.number,
      name: 'a-series',
      values: new ArrayVector([10, 20, 10]),
      config: {
        color: {
          mode: FieldColorModeId.Fixed,
          fixedColor: 'red',
        },
      },
    },
    timeStep: 3600000,
    yAxis: {
      index: 1,
    },
  },
  {
    data: [
      [1546372800000, 20],
      [1546376400000, 30],
      [1546380000000, 40],
    ],
    color: 'blue',
    isVisible: true,
    label: 'B-series',
    seriesIndex: 1,
    timeField: {
      type: FieldType.time,
      name: 'time',
      values: new ArrayVector([1546372800000, 1546376400000, 1546380000000]),
      config: {},
    },
    valueField: {
      type: FieldType.number,
      name: 'b-series',
      values: new ArrayVector([20, 30, 40]),
      config: {
        color: {
          mode: FieldColorModeId.Fixed,
          fixedColor: 'blue',
        },
      },
    },
    timeStep: 3600000,
    yAxis: {
      index: 1,
    },
  },
];

const getStoriesKnobs = () => {
  const rightAxisSeries = text('Right y-axis series, i.e. A,C', '');

  const legendPlacement = select<LegendPlacement>(
    'Legend placement',
    {
      under: 'under',
      right: 'right',
    },
    'under'
  );
  const renderLegendAsTable = select<any>(
    'Render legend as',
    {
      list: false,
      table: true,
    },
    false
  );

  return {
    rightAxisSeries,
    legendPlacement,
    renderLegendAsTable,
  };
};

export const graphWithLegend = () => {
  const { legendPlacement, rightAxisSeries, renderLegendAsTable } = getStoriesKnobs();
  const props: GraphWithLegendProps = {
    series: series.map(s => {
      if (
        rightAxisSeries
          .split(',')
          .map(s => s.trim())
          .indexOf(s.label.split('-')[0]) > -1
      ) {
        s.yAxis = { index: 2 };
      } else {
        s.yAxis = { index: 1 };
      }
      return s;
    }),
    displayMode: renderLegendAsTable ? LegendDisplayMode.Table : LegendDisplayMode.List,
    isLegendVisible: true,
    onToggleSort: () => {},
    timeRange: {
      from: dateTime(1546372800000),
      to: dateTime(1546380000000),
      raw: {
        from: dateTime(1546372800000),
        to: dateTime(1546380000000),
      },
    },
    timeZone: 'browser',
    width: 600,
    height: 300,
    placement: legendPlacement,
  };

  return <GraphWithLegend {...props} />;
};
