import { render, screen } from '@testing-library/react';
import React from 'react';

import { createDimension, createTheme, FieldType, DisplayProcessor } from '@grafana/data';

import { ActiveDimensions } from '../../VizTooltip';

import { MultiModeGraphTooltip } from './MultiModeGraphTooltip';
import { GraphDimensions } from './types';

let dimensions: GraphDimensions;

describe('MultiModeGraphTooltip', () => {
  const display: DisplayProcessor = (v) => ({ numeric: Number(v), text: String(v), color: 'red' });
  const theme = createTheme();

  describe('when shown when hovering over a datapoint', () => {
    beforeEach(() => {
      dimensions = {
        xAxis: createDimension('xAxis', [
          {
            config: {},
            values: [0, 100, 200],
            name: 'A-series time',
            type: FieldType.time,
            display,
          },
          {
            config: {},
            values: [0, 100, 200],
            name: 'B-series time',
            type: FieldType.time,
            display,
          },
        ]),
        yAxis: createDimension('yAxis', [
          {
            config: {},
            values: [10, 20, 10],
            name: 'A-series values',
            type: FieldType.number,
            display,
          },
          {
            config: {},
            values: [20, 30, 40],
            name: 'B-series values',
            type: FieldType.number,
            display,
          },
        ]),
      };
    });

    it('highlights series of the datapoint', () => {
      // We are simulating hover over A-series, middle point
      const activeDimensions: ActiveDimensions<GraphDimensions> = {
        xAxis: [0, 1], // column, row
        yAxis: [0, 1], // column, row
      };
      render(
        <MultiModeGraphTooltip
          dimensions={dimensions}
          activeDimensions={activeDimensions}
          // pos is not relevant in this test
          pos={{ x: 0, y: 0, pageX: 0, pageY: 0, x1: 0, y1: 0 }}
        />
      );

      // We rendered two series rows
      const rows = screen.getAllByTestId('SeriesTableRow');
      expect(rows.length).toEqual(2);

      // We expect A-series(1st row) not to be highlighted
      expect(rows[0]).toHaveStyle(`font-weight: ${theme.typography.fontWeightMedium}`);
      // We expect B-series(2nd row) not to be highlighted
      expect(rows[1]).not.toHaveStyle(`font-weight: ${theme.typography.fontWeightMedium}`);
    });

    it("doesn't highlight series when not hovering over datapoint", () => {
      // We are simulating hover over graph, but not datapoint
      const activeDimensions: ActiveDimensions<GraphDimensions> = {
        xAxis: [0, undefined], // no active point in time
        yAxis: null, // no active series
      };

      render(
        <MultiModeGraphTooltip
          dimensions={dimensions}
          activeDimensions={activeDimensions}
          // pos is not relevant in this test
          pos={{ x: 0, y: 0, pageX: 0, pageY: 0, x1: 0, y1: 0 }}
        />
      );

      // We rendered two series rows
      const rows = screen.getAllByTestId('SeriesTableRow');
      expect(rows.length).toEqual(2);

      // We expect A-series(1st row) not to be highlighted
      expect(rows[0]).not.toHaveStyle(`font-weight: ${theme.typography.fontWeightMedium}`);
      // We expect B-series(2nd row) not to be highlighted
      expect(rows[1]).not.toHaveStyle(`font-weight: ${theme.typography.fontWeightMedium}`);
    });
  });
});
