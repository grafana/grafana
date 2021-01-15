import React from 'react';
import { mount } from 'enzyme';
import Graph from './Graph';
import Chart from '../Chart';
import { GraphSeriesXY, FieldType, ArrayVector, dateTime, FieldColorModeId } from '@grafana/data';

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
      config: { color: { mode: FieldColorModeId.Fixed, fixedColor: 'red' } },
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
    label: 'B-series',
    seriesIndex: 0,
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
      config: { color: { mode: FieldColorModeId.Fixed, fixedColor: 'blue' } },
    },
    timeStep: 3600000,
    yAxis: {
      index: 0,
    },
  },
];

const mockTimeRange = {
  from: dateTime(1546372800000),
  to: dateTime(1546380000000),
  raw: {
    from: dateTime(1546372800000),
    to: dateTime(1546380000000),
  },
};

const mockGraphProps = (multiSeries = false) => {
  return {
    width: 200,
    height: 100,
    series,
    timeRange: mockTimeRange,
    timeZone: 'browser',
  };
};
describe('Graph', () => {
  describe('with tooltip', () => {
    describe('in single mode', () => {
      it("doesn't render tooltip when not hovering over a datapoint", () => {
        const graphWithTooltip = (
          <Graph {...mockGraphProps()}>
            <Chart.Tooltip mode="single" />
          </Graph>
        );

        const container = mount(graphWithTooltip);
        const tooltip = container.find('GraphTooltip');
        expect(tooltip).toHaveLength(0);
      });

      it('renders tooltip when hovering over a datapoint', () => {
        // Given
        const graphWithTooltip = (
          <Graph {...mockGraphProps()}>
            <Chart.Tooltip mode="single" />
          </Graph>
        );
        const container = mount(graphWithTooltip);

        // When
        // Simulating state set by $.flot plothover event when interacting with the canvas with Graph
        // Unfortunately I haven't found a way to perfom the actual mouse hover interaction in JSDOM, hence I'm simulating the state
        container.setState({
          isTooltipVisible: true,
          // This "is" close by middle point, Flot would have pick the middle point at this position
          pos: {
            x: 120,
            y: 50,
          },
          activeItem: {
            seriesIndex: 0,
            dataIndex: 1,
            series: { seriesIndex: 0 },
          },
        });

        // Then
        const tooltip = container.find('GraphTooltip');
        const time = tooltip.find("[aria-label='Timestamp']");
        // Each series should have icon rendered by default GraphTooltip component
        // We are using this to make sure correct amount of series were rendered
        const seriesIcons = tooltip.find('SeriesIcon');

        expect(time).toHaveLength(1);
        expect(tooltip).toHaveLength(1);
        expect(seriesIcons).toHaveLength(1);
      });
    });

    describe('in All Series mode', () => {
      it('it renders all series summary regardless of mouse position', () => {
        // Given
        const graphWithTooltip = (
          <Graph {...mockGraphProps(true)}>
            <Chart.Tooltip mode="multi" />
          </Graph>
        );
        const container = mount(graphWithTooltip);

        // When
        container.setState({
          isTooltipVisible: true,
          // This "is" more or less between first and middle point. Flot would not have picked any point as active one at this position
          pos: {
            x: 80,
            y: 50,
          },
          activeItem: null,
        });

        // Then
        const tooltip = container.find('GraphTooltip');
        const time = tooltip.find("[aria-label='Timestamp']");
        const seriesIcons = tooltip.find('SeriesIcon');

        expect(time).toHaveLength(1);
        expect(tooltip).toHaveLength(1);
        expect(seriesIcons).toHaveLength(2);
      });
    });
  });
});
