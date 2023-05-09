import { Story } from '@storybook/react';
import React from 'react';

import { GraphSeriesXY, FieldType, dateTime, FieldColorModeId } from '@grafana/data';
import { LegendDisplayMode } from '@grafana/schema';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

import { GraphWithLegend, GraphWithLegendProps } from './GraphWithLegend';

export default {
  title: 'Visualizations/Graph/GraphWithLegend',
  component: GraphWithLegend,
  decorator: [withCenteredStory],
  parameters: {
    controls: {
      exclude: ['className', 'ariaLabel', 'legendDisplayMode', 'series'],
    },
  },
  argTypes: {
    displayMode: { control: { type: 'radio' }, options: ['table', 'list', 'hidden'] },
    placement: { control: { type: 'radio' }, options: ['bottom', 'right'] },
    rightAxisSeries: { name: 'Right y-axis series, i.e. A,C' },
    timeZone: { control: { type: 'radio' }, options: ['browser', 'utc'] },
    width: { control: { type: 'range', min: 200, max: 800 } },
    height: { control: { type: 'range', min: 1700, step: 300 } },
    lineWidth: { control: { type: 'range', min: 1, max: 10 } },
  },
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
      values: [1546372800000, 1546376400000, 1546380000000],
      config: {},
    },
    valueField: {
      type: FieldType.number,
      name: 'a-series',
      values: [10, 20, 10],
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
      values: [1546372800000, 1546376400000, 1546380000000],
      config: {},
    },
    valueField: {
      type: FieldType.number,
      name: 'b-series',
      values: [20, 30, 40],
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

interface StoryProps extends GraphWithLegendProps {
  rightAxisSeries: string;
  displayMode: string;
}

export const WithLegend: Story<StoryProps> = ({ rightAxisSeries, displayMode, legendDisplayMode, ...args }) => {
  const props: Partial<GraphWithLegendProps> = {
    series: series.map((s) => {
      if (
        rightAxisSeries
          .split(',')
          .map((s) => s.trim())
          .indexOf(s.label.split('-')[0]) > -1
      ) {
        s.yAxis = { index: 2 };
      } else {
        s.yAxis = { index: 1 };
      }
      return s;
    }),
  };

  return (
    <GraphWithLegend
      legendDisplayMode={displayMode === 'table' ? LegendDisplayMode.Table : LegendDisplayMode.List}
      {...args}
      {...props}
    />
  );
};
WithLegend.args = {
  rightAxisSeries: '',
  displayMode: 'list',
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
  placement: 'bottom',
};
