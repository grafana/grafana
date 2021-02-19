import React from 'react';
import { mount } from 'enzyme';
import { MultiModeGraphTooltip } from './MultiModeGraphTooltip';
import { createDimension, ArrayVector, FieldType } from '@grafana/data';
import { GraphDimensions } from './types';
import { ActiveDimensions } from '../../Chart/Tooltip';

let dimensions: GraphDimensions;

describe('MultiModeGraphTooltip', () => {
  describe('when shown when hovering over a datapoint', () => {
    beforeEach(() => {
      dimensions = {
        xAxis: createDimension('xAxis', [
          {
            config: {},
            values: new ArrayVector([0, 100, 200]),
            name: 'A-series time',
            type: FieldType.time,
          },
          {
            config: {},
            values: new ArrayVector([0, 100, 200]),
            name: 'B-series time',
            type: FieldType.time,
          },
        ]),
        yAxis: createDimension('yAxis', [
          {
            config: {},
            values: new ArrayVector([10, 20, 10]),
            name: 'A-series values',
            type: FieldType.number,
          },
          {
            config: {},
            values: new ArrayVector([20, 30, 40]),
            name: 'B-series values',
            type: FieldType.number,
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
      const container = mount(
        <MultiModeGraphTooltip
          dimensions={dimensions}
          activeDimensions={activeDimensions}
          // pos is not relevant in this test
          pos={{ x: 0, y: 0, pageX: 0, pageY: 0, x1: 0, y1: 0 }}
        />
      );

      // We rendered two series rows
      const rows = container.find('SeriesTableRow');

      // We expect A-series(1st row) to be higlighted
      expect(rows.get(0).props.isActive).toBeTruthy();
      // We expect B-series(2nd row) not to be higlighted
      expect(rows.get(1).props.isActive).toBeFalsy();
    });

    it("doesn't highlight series when not hovering over datapoint", () => {
      // We are simulating hover over graph, but not datapoint
      const activeDimensions: ActiveDimensions<GraphDimensions> = {
        xAxis: [0, undefined], // no active point in time
        yAxis: null, // no active series
      };

      const container = mount(
        <MultiModeGraphTooltip
          dimensions={dimensions}
          activeDimensions={activeDimensions}
          // pos is not relevant in this test
          pos={{ x: 0, y: 0, pageX: 0, pageY: 0, x1: 0, y1: 0 }}
        />
      );

      // We rendered two series rows
      const rows = container.find('SeriesTableRow');

      // We expect A-series(1st row) not to be higlighted
      expect(rows.get(0).props.isActive).toBeFalsy();
      // We expect B-series(2nd row) not to be higlighted
      expect(rows.get(1).props.isActive).toBeFalsy();
    });
  });
});
