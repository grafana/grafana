import { DataFrame, FieldType } from '@grafana/data';
import { SortOrder, TooltipDisplayMode } from '@grafana/schema';

import { calculateTooltipPosition, getContentItems } from './utils';

describe('utils', () => {
  describe('calculateTooltipPosition', () => {
    // let's pick some easy numbers for these, we shouldn't need to change them
    const tooltipWidth = 100;
    const tooltipHeight = 100;
    const xOffset = 10;
    const yOffset = 10;
    const windowWidth = 200;
    const windowHeight = 200;

    it('sticky positions the tooltip to the right if it would overflow at both ends but overflow to the left more', () => {
      const xPos = 99;
      const yPos = 50;
      const result = calculateTooltipPosition(
        xPos,
        yPos,
        tooltipWidth,
        tooltipHeight,
        xOffset,
        yOffset,
        windowWidth,
        windowHeight
      );
      expect(result).toEqual({
        x: 90,
        y: 60,
      });
    });

    it('sticky positions the tooltip to the left if it would overflow at both ends but overflow to the right more', () => {
      const xPos = 101;
      const yPos = 50;
      const result = calculateTooltipPosition(
        xPos,
        yPos,
        tooltipWidth,
        tooltipHeight,
        xOffset,
        yOffset,
        windowWidth,
        windowHeight
      );
      expect(result).toEqual({
        x: 10,
        y: 60,
      });
    });

    it('positions the tooltip to left of the cursor if it would overflow right', () => {
      const xPos = 150;
      const yPos = 50;
      const result = calculateTooltipPosition(
        xPos,
        yPos,
        tooltipWidth,
        tooltipHeight,
        xOffset,
        yOffset,
        windowWidth,
        windowHeight
      );
      expect(result).toEqual({
        x: 40,
        y: 60,
      });
    });

    it('positions the tooltip to the right of the cursor if it would not overflow', () => {
      const xPos = 50;
      const yPos = 50;
      const result = calculateTooltipPosition(
        xPos,
        yPos,
        tooltipWidth,
        tooltipHeight,
        xOffset,
        yOffset,
        windowWidth,
        windowHeight
      );
      expect(result).toEqual({
        x: 60,
        y: 60,
      });
    });

    it('sticky positions the tooltip to the bottom if it would overflow at both ends but overflow to the top more', () => {
      const xPos = 50;
      const yPos = 99;
      const result = calculateTooltipPosition(
        xPos,
        yPos,
        tooltipWidth,
        tooltipHeight,
        xOffset,
        yOffset,
        windowWidth,
        windowHeight
      );
      expect(result).toEqual({
        x: 60,
        y: 90,
      });
    });

    it('sticky positions the tooltip to the top if it would overflow at both ends but overflow to the bottom more', () => {
      const xPos = 50;
      const yPos = 101;
      const result = calculateTooltipPosition(
        xPos,
        yPos,
        tooltipWidth,
        tooltipHeight,
        xOffset,
        yOffset,
        windowWidth,
        windowHeight
      );
      expect(result).toEqual({
        x: 60,
        y: 10,
      });
    });

    it('positions the tooltip above the cursor if it would overflow at the bottom', () => {
      const xPos = 50;
      const yPos = 150;
      const result = calculateTooltipPosition(
        xPos,
        yPos,
        tooltipWidth,
        tooltipHeight,
        xOffset,
        yOffset,
        windowWidth,
        windowHeight
      );
      expect(result).toEqual({
        x: 60,
        y: 40,
      });
    });

    it('positions the tooltip below the cursor if it would not overflow', () => {
      const xPos = 50;
      const yPos = 50;
      const result = calculateTooltipPosition(
        xPos,
        yPos,
        tooltipWidth,
        tooltipHeight,
        xOffset,
        yOffset,
        windowWidth,
        windowHeight
      );
      expect(result).toEqual({
        x: 60,
        y: 60,
      });
    });
  });

  describe('it tests getContentItems with numeric values', () => {
    const timeValues = [1707833954056, 1707838274056, 1707842594056];
    const seriesAValues = [1, 20, 70];
    const seriesBValues = [-100, -26, null];

    const frame = {
      name: 'a',
      length: timeValues.length,
      fields: [
        {
          name: 'time',
          type: FieldType.time,
          values: timeValues[0],
          config: {},
          display: (value: string) => ({
            text: value,
            color: undefined,
            numeric: NaN,
          }),
        },
        {
          name: 'A-series',
          type: FieldType.number,
          values: seriesAValues,
          config: {},
          display: (value: string) => ({
            text: value,
            color: undefined,
            numeric: Number(value),
          }),
        },
        {
          name: 'B-series',
          type: FieldType.number,
          values: seriesBValues,
          config: {},
          display: (value: string) => ({
            text: value,
            color: undefined,
            numeric: Number(value),
          }),
        },
      ],
    } as unknown as DataFrame;

    const fields = frame.fields;
    const xField = frame.fields[0];
    const dataIdxs = [1, 1, 1];

    it('displays one series in single mode', () => {
      const rows = getContentItems(fields, xField, dataIdxs, 2, TooltipDisplayMode.Single, SortOrder.None);
      expect(rows.length).toBe(1);
      expect(rows[0].value).toBe('-26');
    });

    it('displays the right content in multi mode', () => {
      const rows = getContentItems(fields, xField, dataIdxs, null, TooltipDisplayMode.Multi, SortOrder.None);
      expect(rows.length).toBe(2);
      expect(rows[0].value).toBe('20');
      expect(rows[1].value).toBe('-26');
    });

    it('displays the values sorted ASC', () => {
      const rows = getContentItems(fields, xField, dataIdxs, null, TooltipDisplayMode.Multi, SortOrder.Ascending);
      expect(rows.length).toBe(2);
      expect(rows[0].value).toBe('-26');
      expect(rows[1].value).toBe('20');
    });

    it('displays the values sorted DESC', () => {
      const rows = getContentItems(fields, xField, dataIdxs, null, TooltipDisplayMode.Multi, SortOrder.Descending);
      expect(rows.length).toBe(2);
      expect(rows[0].value).toBe('20');
      expect(rows[1].value).toBe('-26');
    });

    it('displays the correct value when NULL values', () => {
      const rows = getContentItems(fields, xField, [2, 2, null], null, TooltipDisplayMode.Multi, SortOrder.Descending);
      expect(rows.length).toBe(1);
      expect(rows[0].value).toBe('70');
    });

    it('filters out values when specified', () => {
      const aField = { ...fields[1], values: [0, 3, 5] };
      const bField = { ...fields[2], values: [5, 0, 7] };

      let rows = getContentItems(
        [fields[0], aField, bField],
        xField,
        dataIdxs,
        null,
        TooltipDisplayMode.Multi,
        SortOrder.Ascending,
        undefined,
        true
      );

      expect(rows.length).toBe(1);
      expect(rows[0].value).toBe('3');

      rows = getContentItems(
        [fields[0], aField, bField],
        xField,
        [0, 0, 0],
        null,
        TooltipDisplayMode.Multi,
        SortOrder.Ascending,
        undefined,
        true
      );

      expect(rows.length).toBe(1);
      expect(rows[0].value).toBe('5');
    });
  });

  describe('it tests getContentItems with string values', () => {
    const timeValues = [1707833954056, 1707838274056, 1707842594056];
    const seriesAValues = ['LOW', 'HIGH', 'NORMAL'];
    const seriesBValues = ['NORMAL', 'LOW', 'LOW'];

    const frame = {
      name: 'a',
      length: timeValues.length,
      fields: [
        {
          name: 'time',
          type: FieldType.time,
          values: timeValues[0],
          config: {},
          display: (value: string) => ({
            text: value,
            color: undefined,
            numeric: NaN,
          }),
        },
        {
          name: 'A-series',
          type: FieldType.string,
          values: seriesAValues,
          config: {},
          display: (value: string) => ({
            text: value,
            color: undefined,
            numeric: NaN,
          }),
        },
        {
          name: 'B-series',
          type: FieldType.string,
          values: seriesBValues,
          config: {},
          display: (value: string) => ({
            text: value,
            color: undefined,
            numeric: NaN,
          }),
        },
      ],
    } as unknown as DataFrame;

    const fields = frame.fields;
    const xField = frame.fields[0];
    const dataIdxs = [null, 0, 0];

    it('displays one series in single mode', () => {
      const rows = getContentItems(fields, xField, [null, null, 0], 2, TooltipDisplayMode.Single, SortOrder.None);
      expect(rows.length).toBe(1);
      expect(rows[0].value).toBe('NORMAL');
    });

    it('displays the right content in multi mode', () => {
      const rows = getContentItems(fields, xField, dataIdxs, 2, TooltipDisplayMode.Multi, SortOrder.None);
      expect(rows.length).toBe(2);
      expect(rows[0].value).toBe('LOW');
      expect(rows[1].value).toBe('NORMAL');
    });

    it('displays the values sorted ASC', () => {
      const rows = getContentItems(fields, xField, dataIdxs, 2, TooltipDisplayMode.Multi, SortOrder.Ascending);
      expect(rows.length).toBe(2);
      expect(rows[0].value).toBe('LOW');
      expect(rows[1].value).toBe('NORMAL');
    });

    it('displays the values sorted DESC', () => {
      const rows = getContentItems(
        frame.fields,
        frame.fields[0],
        dataIdxs,
        2,
        TooltipDisplayMode.Multi,
        SortOrder.Descending
      );
      expect(rows.length).toBe(2);
      expect(rows[0].value).toBe('NORMAL');
      expect(rows[1].value).toBe('LOW');
    });
  });
});
