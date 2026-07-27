import { type DataFrame, type Field, FieldType, type LinkModel } from '@grafana/data';
import { SortOrder, TooltipDisplayMode } from '@grafana/schema';

import { type ColorIndicatorStyles } from './VizTooltipColorIndicator';
import { VizTooltipColorIndicator } from './types';
import {
  calculateTooltipPosition,
  getColorIndicatorClass,
  getFieldDisplayItems,
  getFieldDisplayLinks,
  getTooltipDisplayValue,
  isTooltipScrollable,
} from './utils';

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

  describe('getFieldDisplayItems with numeric values', () => {
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
      const rows = getFieldDisplayItems(fields, xField, dataIdxs, 2, TooltipDisplayMode.Single, SortOrder.None);
      expect(rows.length).toBe(1);
      expect(rows[0].value).toBe('-26');
    });

    it('displays the right content in multi mode', () => {
      const rows = getFieldDisplayItems(fields, xField, dataIdxs, null, TooltipDisplayMode.Multi, SortOrder.None);
      expect(rows.length).toBe(2);
      expect(rows[0].value).toBe('20');
      expect(rows[1].value).toBe('-26');
    });

    it('displays the values sorted ASC', () => {
      const rows = getFieldDisplayItems(fields, xField, dataIdxs, null, TooltipDisplayMode.Multi, SortOrder.Ascending);
      expect(rows.length).toBe(2);
      expect(rows[0].value).toBe('-26');
      expect(rows[1].value).toBe('20');
    });

    it('displays the values sorted DESC', () => {
      const rows = getFieldDisplayItems(fields, xField, dataIdxs, null, TooltipDisplayMode.Multi, SortOrder.Descending);
      expect(rows.length).toBe(2);
      expect(rows[0].value).toBe('20');
      expect(rows[1].value).toBe('-26');
    });

    it('displays the correct value when NULL values', () => {
      const rows = getFieldDisplayItems(
        fields,
        xField,
        [2, 2, null],
        null,
        TooltipDisplayMode.Multi,
        SortOrder.Descending
      );
      expect(rows.length).toBe(1);
      expect(rows[0].value).toBe('70');
    });

    it('filters out zeros when hideZeros is true', () => {
      const aField = { ...fields[1], values: [0, 3, 5] };
      const bField = { ...fields[2], values: [5, 0, 7] };

      let rows = getFieldDisplayItems(
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

      rows = getFieldDisplayItems(
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

    it('marks the hovered series as active in multi mode', () => {
      const rows = getFieldDisplayItems(fields, xField, dataIdxs, 1, TooltipDisplayMode.Multi, SortOrder.None);
      expect(rows[0].isActive).toBe(true);
      expect(rows[1].isActive).toBe(false);
    });

    it('uses field.state.displayName when available', () => {
      const namedField = { ...fields[1], state: { displayName: 'Custom Name' } };
      const rows = getFieldDisplayItems(
        [fields[0], namedField],
        xField,
        dataIdxs,
        null,
        TooltipDisplayMode.Multi,
        SortOrder.None
      );
      expect(rows[0].label).toBe('Custom Name');
    });

    it('skips fields with hideFrom.tooltip set', () => {
      const hiddenField = { ...fields[1], config: { custom: { hideFrom: { tooltip: true } } } };
      const rows = getFieldDisplayItems(
        [fields[0], hiddenField, fields[2]],
        xField,
        dataIdxs,
        null,
        TooltipDisplayMode.Multi,
        SortOrder.None
      );
      expect(rows.length).toBe(1);
      expect(rows[0].label).toBe('B-series');
    });

    it('applies fieldFilter to exclude fields', () => {
      const rows = getFieldDisplayItems(
        fields,
        xField,
        dataIdxs,
        null,
        TooltipDisplayMode.Multi,
        SortOrder.None,
        (field) => field.name === 'A-series'
      );
      expect(rows.length).toBe(1);
      expect(rows[0].label).toBe('A-series');
    });

    it('includes extraFields as isHiddenFromViz items', () => {
      const restField = {
        ...fields[1],
        name: 'rest-series',
        values: [99, 88, 77],
        config: {},
      };
      const rows = getFieldDisplayItems(
        [fields[0], fields[1]],
        xField,
        [1, 1],
        null,
        TooltipDisplayMode.Multi,
        SortOrder.None,
        undefined,
        false,
        [restField]
      );
      const restRow = rows.find((r) => r.label === 'rest-series');
      expect(restRow).toBeDefined();
      expect(restRow!.isHiddenFromViz).toBe(true);
    });
  });

  describe('getFieldDisplayItems with string values', () => {
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
      const rows = getFieldDisplayItems(fields, xField, [null, null, 0], 2, TooltipDisplayMode.Single, SortOrder.None);
      expect(rows.length).toBe(1);
      expect(rows[0].value).toBe('NORMAL');
    });

    it('displays the right content in multi mode', () => {
      const rows = getFieldDisplayItems(fields, xField, dataIdxs, 2, TooltipDisplayMode.Multi, SortOrder.None);
      expect(rows.length).toBe(2);
      expect(rows[0].value).toBe('LOW');
      expect(rows[1].value).toBe('NORMAL');
    });

    it('displays the values sorted ASC', () => {
      const rows = getFieldDisplayItems(fields, xField, dataIdxs, 2, TooltipDisplayMode.Multi, SortOrder.Ascending);
      expect(rows.length).toBe(2);
      expect(rows[0].value).toBe('LOW');
      expect(rows[1].value).toBe('NORMAL');
    });

    it('displays the values sorted DESC', () => {
      const rows = getFieldDisplayItems(
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

  describe('getDisplayValueString', () => {
    const mockField = {
      name: 'test-field',
      type: FieldType.string,
      values: [],
      config: {},
      display: (value: unknown) => ({
        text: String(value),
        numeric: typeof value === 'number' ? value : NaN,
        color: '#000',
      }),
    } satisfies Field;

    it('returns empty string for empty arrays', () => {
      const result = getTooltipDisplayValue([], mockField);
      expect(result.text).toBe('');
      expect(result.numeric).toBeNaN();
    });

    it('returns JSON.stringify for non-empty arrays', () => {
      const value = [1, 2, 3];
      const result = getTooltipDisplayValue(value, mockField);
      expect(result.text).toBe('[1,2,3]');
      expect(result.numeric).toBeNaN();
    });

    it('returns JSON.stringify for arrays of objects', () => {
      const value = [
        { key: 'foo', value: 'bar' },
        { key: 'baz', value: 'qux' },
      ];
      const result = getTooltipDisplayValue(value, mockField);
      expect(result.text).toBe('[{"key":"foo","value":"bar"},{"key":"baz","value":"qux"}]');
      expect(result.numeric).toBeNaN();
    });

    it('returns JSON.stringify for objects', () => {
      const value = { refType: 'EXTERNAL', spanID: '123', tags: [{ key: 'service', value: 'api' }] };
      const result = getTooltipDisplayValue(value, mockField);
      expect(result.text).toBe('{"refType":"EXTERNAL","spanID":"123","tags":[{"key":"service","value":"api"}]}');
      expect(result.numeric).toBeNaN();
    });

    it('uses field.display for standard string values', () => {
      const result = getTooltipDisplayValue('test-string', mockField);
      expect(result.text).toBe('test-string');
      expect(result.numeric).toBeNaN();
      expect(result.color).toBe('#000');
    });

    it('uses field.display for numeric values', () => {
      const numericField = {
        ...mockField,
        type: FieldType.number,
        display: (value: unknown) => ({
          text: String(value),
          numeric: Number(value),
          color: '#00f',
        }),
      } satisfies Field;

      const result = getTooltipDisplayValue(42, numericField);
      expect(result.text).toBe('42');
      expect(result.numeric).toBe(42);
      expect(result.color).toBe('#00f');
    });

    it('uses field.display for null values', () => {
      const result = getTooltipDisplayValue(null, mockField);
      expect(result.text).toBe('null');
      expect(result.numeric).toBeNaN();
      expect(result.color).toBe('#000');
    });

    it('uses field.display for undefined values', () => {
      const result = getTooltipDisplayValue(undefined, mockField);
      expect(result.text).toBe('undefined');
      expect(result.numeric).toBeNaN();
      expect(result.color).toBe('#000');
    });

    it('uses field.display for boolean values', () => {
      const result = getTooltipDisplayValue(true, mockField);
      expect(result.text).toBe('true');
      expect(result.numeric).toBeNaN();
      expect(result.color).toBe('#000');
    });

    it('handles arrays with nested arrays', () => {
      const value = [
        [1, 2],
        [3, 4],
      ];
      const result = getTooltipDisplayValue(value, mockField);
      expect(result.text).toBe('[[1,2],[3,4]]');
      expect(result.numeric).toBeNaN();
    });
  });

  describe('getColorIndicatorClass', () => {
    const mockStyles = {
      series: 'series-class',
      value: 'value-class',
      hexagon: 'hexagon-class',
      pie_1_4: 'pie1-class',
      pie_2_4: 'pie2-class',
      pie_3_4: 'pie3-class',
      marker_sm: 'sm-class',
      marker_md: 'md-class',
      marker_lg: 'lg-class',
      leading: 'leading-class',
      trailing: 'trailing-class',
      seriesIndicator: 'series-indicator-class',
    } satisfies ColorIndicatorStyles;

    it.each([
      VizTooltipColorIndicator.series,
      VizTooltipColorIndicator.value,
      VizTooltipColorIndicator.hexagon,
      VizTooltipColorIndicator.pie_1_4,
      VizTooltipColorIndicator.pie_2_4,
      VizTooltipColorIndicator.pie_3_4,
      VizTooltipColorIndicator.marker_sm,
      VizTooltipColorIndicator.marker_md,
      VizTooltipColorIndicator.marker_lg,
    ])('returns correct class for %s indicator', (indicator) => {
      const expectedClass = mockStyles[indicator as keyof ColorIndicatorStyles];
      expect(getColorIndicatorClass(indicator, mockStyles)).toBe(expectedClass);
    });

    it('returns value class as default for unknown indicator', () => {
      expect(getColorIndicatorClass('unknown-indicator', mockStyles)).toBe('value-class');
    });
  });

  describe('getFieldDisplayLinks', () => {
    const makeField = (overrides: Partial<Field> = {}): Field =>
      ({
        name: 'value',
        type: FieldType.number,
        values: [10, 20, 30],
        config: { links: [{ title: 'Link A', url: 'https://example.com/${__value.raw}' }] },
        display: (v: unknown) => ({ text: String(v), numeric: Number(v), color: undefined }),
        getLinks: ({ calculatedValue }: { calculatedValue: { text: string; numeric: number } }) => [
          {
            title: 'Link A',
            href: `https://example.com/${calculatedValue.text}`,
            target: '_blank',
            origin: {} as Field,
          },
        ],
        state: {},
        ...overrides,
      }) as unknown as Field;

    it('returns resolved links for a hovered data point', () => {
      const field = makeField();
      const links = getFieldDisplayLinks(field, 1);
      expect(links).toHaveLength(1);
      expect(links[0].title).toBe('Link A');
      expect(links[0].href).toBe('https://example.com/20');
    });

    it('returns an empty array when the field has no links config', () => {
      const field = makeField({ config: {} });
      expect(getFieldDisplayLinks(field, 0)).toEqual([]);
    });

    it('returns an empty array when getLinks is not defined on the field', () => {
      const field = makeField({ getLinks: undefined });
      expect(getFieldDisplayLinks(field, 0)).toEqual([]);
    });

    it('deduplicates links with the same title/href', () => {
      const field = makeField({
        getLinks: () => [
          { title: 'Dup', href: 'https://example.com/dup', target: '_blank', origin: {} as Field },
          { title: 'Dup', href: 'https://example.com/dup', target: '_blank', origin: {} as Field },
          { title: 'Other', href: 'https://example.com/other', target: '_blank', origin: {} as Field },
        ],
      });
      const links = getFieldDisplayLinks(field, 0);
      expect(links).toHaveLength(2);
      expect(links.map((l: LinkModel<Field>) => l.title)).toEqual(['Dup', 'Other']);
    });

    it('uses the display function to resolve the calculated value', () => {
      const display = jest.fn((v: unknown) => ({ text: `formatted-${v}`, numeric: Number(v), color: undefined }));
      const getLinks = jest.fn(() => []);
      const field = makeField({ display, getLinks });
      getFieldDisplayLinks(field, 2);
      expect(display).toHaveBeenCalledWith(30);
      expect(getLinks).toHaveBeenCalledWith(
        expect.objectContaining({ calculatedValue: expect.objectContaining({ text: 'formatted-30' }) })
      );
    });

    it('falls back to a plain text display when field.display is not defined', () => {
      const getLinks = jest.fn(() => []);
      const field = makeField({ display: undefined, getLinks });
      getFieldDisplayLinks(field, 0);
      expect(getLinks).toHaveBeenCalledWith(
        expect.objectContaining({ calculatedValue: expect.objectContaining({ text: '10', numeric: 10 }) })
      );
    });
  });

  describe('isTooltipScrollable', () => {
    it('returns false when mode is Single', () => {
      expect(isTooltipScrollable({ mode: TooltipDisplayMode.Single, maxHeight: 200 })).toBe(false);
    });

    it('returns false when mode is Multi but maxHeight is undefined', () => {
      expect(isTooltipScrollable({ mode: TooltipDisplayMode.Multi })).toBe(false);
    });

    it('returns true when mode is Multi and maxHeight is set', () => {
      expect(isTooltipScrollable({ mode: TooltipDisplayMode.Multi, maxHeight: 200 })).toBe(true);
    });

    it('returns false when maxHeight is null', () => {
      expect(isTooltipScrollable({ mode: TooltipDisplayMode.Multi, maxHeight: undefined })).toBe(false);
    });
  });
});
