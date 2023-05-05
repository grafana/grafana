import { act, render, screen } from '@testing-library/react';
import $ from 'jquery';
import React from 'react';

import { GraphSeriesXY, FieldType, dateTime, FieldColorModeId, DisplayProcessor } from '@grafana/data';
import { TooltipDisplayMode } from '@grafana/schema';

import { VizTooltip } from '../VizTooltip';

import Graph from './Graph';

const display: DisplayProcessor = (v) => ({ numeric: Number(v), text: String(v), color: 'red' });

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
      config: { color: { mode: FieldColorModeId.Fixed, fixedColor: 'red' } },
      display,
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
      values: [1546372800000, 1546376400000, 1546380000000],
      config: {},
    },
    valueField: {
      type: FieldType.number,
      name: 'b-series',
      values: [20, 30, 40],
      config: { color: { mode: FieldColorModeId.Fixed, fixedColor: 'blue' } },
      display,
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

window.ResizeObserver = class ResizeObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('Graph', () => {
  describe('with tooltip', () => {
    describe('in single mode', () => {
      it("doesn't render tooltip when not hovering over a datapoint", () => {
        const graphWithTooltip = (
          <Graph {...mockGraphProps()}>
            <VizTooltip mode={TooltipDisplayMode.Single} />
          </Graph>
        );
        render(graphWithTooltip);

        const timestamp = screen.queryByLabelText('Timestamp');
        const tableRow = screen.queryByTestId('SeriesTableRow');
        const seriesIcon = screen.queryByTestId('series-icon');

        expect(timestamp).toBeFalsy();
        expect(timestamp?.parentElement).toBeFalsy();
        expect(tableRow?.parentElement).toBeFalsy();
        expect(seriesIcon).toBeFalsy();
      });

      it('renders tooltip when hovering over a datapoint', () => {
        // Given
        const graphWithTooltip = (
          <Graph {...mockGraphProps()}>
            <VizTooltip mode={TooltipDisplayMode.Single} />
          </Graph>
        );
        render(graphWithTooltip);
        const eventArgs = {
          pos: {
            x: 120,
            y: 50,
          },
          activeItem: {
            seriesIndex: 0,
            dataIndex: 1,
            series: { seriesIndex: 0 },
          },
        };
        act(() => {
          $('div.graph-panel__chart').trigger('plothover', [eventArgs.pos, eventArgs.activeItem]);
        });
        const timestamp = screen.getByLabelText('Timestamp');
        const tooltip = screen.getByTestId('SeriesTableRow').parentElement;

        expect(timestamp.parentElement?.isEqualNode(tooltip)).toBe(true);
        expect(screen.getAllByTestId('series-icon')).toHaveLength(1);
      });
    });

    describe('in All Series mode', () => {
      it('it renders all series summary regardless of mouse position', () => {
        // Given
        const graphWithTooltip = (
          <Graph {...mockGraphProps(true)}>
            <VizTooltip mode={TooltipDisplayMode.Multi} />
          </Graph>
        );
        render(graphWithTooltip);

        // When
        const eventArgs = {
          // This "is" more or less between first and middle point. Flot would not have picked any point as active one at this position
          pos: {
            x: 80,
            y: 50,
          },
          activeItem: null,
        };
        // Then
        act(() => {
          $('div.graph-panel__chart').trigger('plothover', [eventArgs.pos, eventArgs.activeItem]);
        });
        const timestamp = screen.getByLabelText('Timestamp');

        const tableRows = screen.getAllByTestId('SeriesTableRow');
        expect(tableRows).toHaveLength(2);
        expect(timestamp.parentElement?.isEqualNode(tableRows[0].parentElement)).toBe(true);
        expect(timestamp.parentElement?.isEqualNode(tableRows[1].parentElement)).toBe(true);

        const seriesIcon = screen.getAllByTestId('series-icon');
        expect(seriesIcon).toHaveLength(2);
      });
    });
  });
});
