import React from 'react';
import { Graph } from '@grafana/ui';
import Chart from '../Chart';
import { dateTime, ArrayVector, FieldType, GraphSeriesXY, FieldColorModeId } from '@grafana/data';
import { select } from '@storybook/addon-knobs';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { TooltipContentProps } from '../Chart/Tooltip';
import { JSONFormatter } from '../JSONFormatter/JSONFormatter';

export default {
  title: 'Visualizations/Graph',
  component: Graph,
  decorators: [withCenteredStory],
};

const getKnobs = () => {
  return {
    tooltipMode: select(
      'Tooltip mode',
      {
        multi: 'multi',
        single: 'single',
      },
      'single'
    ),
  };
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
      index: 0,
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
    label:
      "B-series with an ultra wide label that probably gonna make the tooltip to overflow window. This situation happens, so let's better make sure it behaves nicely :)",
    seriesIndex: 1,
    timeField: {
      type: FieldType.time,
      name: 'time',
      values: new ArrayVector([1546372800000, 1546376400000, 1546380000000]),
      config: {},
    },
    valueField: {
      type: FieldType.number,
      name:
        "B-series with an ultra wide label that is probably going go make the tooltip overflow window. This situation happens, so let's better make sure it behaves nicely :)",
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
      index: 0,
    },
  },
];

export const withTooltip = () => {
  const { tooltipMode } = getKnobs();
  return (
    <Graph
      height={300}
      width={600}
      series={series}
      timeRange={{
        from: dateTime(1546372800000),
        to: dateTime(1546380000000),
        raw: {
          from: dateTime(1546372800000),
          to: dateTime(1546380000000),
        },
      }}
      timeZone="browser"
    >
      <Chart.Tooltip mode={tooltipMode} />
    </Graph>
  );
};

const CustomGraphTooltip: React.FC<TooltipContentProps> = ({ activeDimensions }) => {
  return (
    <div style={{ height: '200px' }}>
      <div>Showing currently active active dimensions:</div>
      <JSONFormatter json={activeDimensions || {}} />
    </div>
  );
};

export const withCustomTooltip = () => {
  const { tooltipMode } = getKnobs();
  return (
    <Graph
      height={300}
      width={600}
      series={series}
      timeRange={{
        from: dateTime(1546372800000),
        to: dateTime(1546380000000),
        raw: {
          from: dateTime(1546372800000),
          to: dateTime(1546380000000),
        },
      }}
      timeZone="browser"
    >
      <Chart.Tooltip mode={tooltipMode} tooltipComponent={CustomGraphTooltip} />
    </Graph>
  );
};
