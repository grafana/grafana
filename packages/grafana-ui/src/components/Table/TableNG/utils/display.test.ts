import WKT from 'ol/format/WKT';
import { Point, type Geometry } from 'ol/geom';

import {
  createDataFrame,
  createTheme,
  FieldType,
  type DisplayValue,
  type Field,
  type LinkModel,
  type ValueLinkConfig,
} from '@grafana/data';
import { TableCellBackgroundDisplayMode } from '@grafana/schema';

import { TableCellDisplayMode } from '../../types';

import {
  buildInspectValue,
  displayJsonValue,
  getAlignmentFactor,
  getApplyToRowBgFn,
  getCellColorInlineStylesFactory,
  getCellLinks,
  parseStyleJson,
  prepareSparklineValue,
} from './display';

describe('getApplyToRowBgFn', () => {
  const theme = createTheme();

  const makeColorBackgroundField = (color: string, applyToRow: boolean): Field => ({
    name: color,
    type: FieldType.number,
    values: [1],
    config: {
      custom: {
        cellOptions: {
          type: TableCellDisplayMode.ColorBackground,
          mode: TableCellBackgroundDisplayMode.Basic,
          applyToRow,
        },
      },
    },
    display: () => ({ text: '1', numeric: 1, color }),
  });

  it('returns undefined when no field has applyToRow enabled', () => {
    const fields = [makeColorBackgroundField('#ff0000', false), makeColorBackgroundField('#0000ff', false)];
    const getCellColorInlineStyles = getCellColorInlineStylesFactory(theme);
    expect(getApplyToRowBgFn(fields, getCellColorInlineStyles)).toBeUndefined();
  });

  it('uses the color of the first (leftmost) field with applyToRow enabled', () => {
    const fields = [makeColorBackgroundField('#ff0000', true), makeColorBackgroundField('#0000ff', true)];
    const getCellColorInlineStyles = getCellColorInlineStylesFactory(theme);
    const rowBgFn = getApplyToRowBgFn(fields, getCellColorInlineStyles);
    expect(rowBgFn?.(0).background).toBe('#ff0000');
  });

  it('skips fields without applyToRow when picking the winning field', () => {
    const fields = [makeColorBackgroundField('#ff0000', false), makeColorBackgroundField('#0000ff', true)];
    const getCellColorInlineStyles = getCellColorInlineStylesFactory(theme);
    const rowBgFn = getApplyToRowBgFn(fields, getCellColorInlineStyles);
    expect(rowBgFn?.(0).background).toBe('#0000ff');
  });
});

describe('getAlignmentFactor', () => {
  it('should create a new alignment factor when none exists', () => {
    // Create a field with no existing alignment factor
    const field: Field = {
      name: 'test',
      type: FieldType.number,
      config: {},
      values: [1, 22, 333, 4444],
      // No state property initially
      display: (value: unknown) => ({ text: String(value), numeric: Number(value) }),
    };

    // Create a display value
    const displayValue: DisplayValue = { text: '1', numeric: 1 };

    // Call getAlignmentFactor with the first row
    const result = getAlignmentFactor(field, displayValue, 0);

    // Verify the result has the text property
    expect(result).toEqual(expect.objectContaining({ text: '1' }));

    // Verify that field.state was created and contains the alignment factor
    expect(field.state).toBeDefined();
    expect(field.state?.alignmentFactors).toBeDefined();
    expect(field.state?.alignmentFactors).toEqual(expect.objectContaining({ text: '1' }));
  });

  it('should update alignment factor when a longer value is found', () => {
    // Create a field with an existing alignment factor
    const field: Field = {
      name: 'test',
      type: FieldType.number,
      config: {},
      values: [1, 22, 333, 4444],
      state: { alignmentFactors: { text: '1' } },
      display: (value: unknown) => ({ text: String(value), numeric: Number(value) }),
    };

    // Create a display value that is longer than the existing alignment factor
    const displayValue: DisplayValue = { text: '4444', numeric: 4444 };

    // Call getAlignmentFactor
    const result = getAlignmentFactor(field, displayValue, 3);

    // Verify the result is updated to the longer value
    expect(result).toEqual(expect.objectContaining({ text: '4444' }));

    // Verify that field.state.alignmentFactors was updated
    expect(field.state?.alignmentFactors).toEqual(expect.objectContaining({ text: '4444' }));
  });

  it('should not update alignment factor when a shorter value is found', () => {
    // Create a field with an existing alignment factor for a long value
    const field: Field = {
      name: 'test',
      type: FieldType.number,
      config: {},
      values: [1, 22, 333, 4444],
      state: { alignmentFactors: { text: '4444' } },
      display: (value: unknown) => ({ text: String(value), numeric: Number(value) }),
    };

    // Create a display value that is shorter than the existing alignment factor
    const displayValue: DisplayValue = { text: '1', numeric: 1 };

    // Call getAlignmentFactor
    const result = getAlignmentFactor(field, displayValue, 0);

    // Verify the result is still the longer value
    expect(result).toEqual(expect.objectContaining({ text: '4444' }));

    // Verify that field.state.alignmentFactors was not changed
    expect(field.state?.alignmentFactors).toEqual(expect.objectContaining({ text: '4444' }));
  });

  it('should add alignment factor to existing field state', () => {
    // Create a field with existing state but no alignment factors yet
    const field: Field = {
      name: 'test',
      type: FieldType.number,
      config: {},
      values: [1, 22, 333, 4444],
      // Field has state but no alignmentFactors
      state: {
        // Use a valid property for FieldState
        // For example, if calcs is a valid property:
        calcs: { sum: 4460 },
        // Or if noValue is a valid property:
        // noValue: true
      },
      display: (value: unknown) => ({ text: String(value), numeric: Number(value) }),
    };

    // Create a display value
    const displayValue: DisplayValue = { text: '1', numeric: 1 };

    // Call getAlignmentFactor with the first row
    const result = getAlignmentFactor(field, displayValue, 0);

    // Verify the result has the text property
    expect(result).toEqual(expect.objectContaining({ text: '1' }));

    // Verify that field.state was preserved and alignment factor was added
    expect(field.state).toBeDefined();
    // Check for the valid property we used
    expect(field.state?.calcs).toBeDefined();
    expect(field.state?.alignmentFactors).toBeDefined();
    expect(field.state?.alignmentFactors).toEqual(expect.objectContaining({ text: '1' }));
  });

  it.todo('alignmentFactor.text = displayValue.text;');
});

describe('getCellLinks', () => {
  it('should return undefined when field has no getLinks function', () => {
    const field: Field = { name: 'test', type: FieldType.string, config: {}, values: ['value'] };

    const links = getCellLinks(field, 0);
    expect(links).toEqual(undefined);
  });

  it('should return links from field getLinks function', () => {
    const mockLinks: LinkModel[] = [
      { title: 'Link 1', href: 'http://example.com/1', target: '_blank', origin: { datasourceUid: 'test' } },
      { title: 'Link 2', href: 'http://example.com/2', target: '_self', origin: { datasourceUid: 'test' } },
    ];

    const field: Field = {
      name: 'test',
      type: FieldType.string,
      config: {},
      values: ['value1', 'value2'],
      getLinks: (config: ValueLinkConfig) => {
        return config.valueRowIndex === 0 ? mockLinks : [];
      },
    };

    const links = getCellLinks(field, 0);
    expect(links).toEqual(mockLinks);
  });

  it('should return empty array for out of bounds index', () => {
    const mockLinks: LinkModel[] = [
      { title: 'Link 1', href: 'http://example.com/1', target: '_blank', origin: { datasourceUid: 'test' } },
    ];

    const field: Field = {
      name: 'test',
      type: FieldType.string,
      config: {},
      values: ['value1'],
      getLinks: (config: ValueLinkConfig) => {
        return config.valueRowIndex === 0 ? mockLinks : [];
      },
    };

    // Index out of bounds
    const links = getCellLinks(field, 1);
    expect(links).toEqual([]);
  });

  it('should handle getLinks returning undefined', () => {
    const field: Field = {
      name: 'test',
      type: FieldType.string,
      config: {},
      values: ['value1'],
      getLinks: (config: ValueLinkConfig) => {
        return [];
      },
    };

    const links = getCellLinks(field, 0);
    expect(links).toEqual([]);
  });

  it('should handle different link configurations', () => {
    // Create links with different valid configurations
    const mockLinks: LinkModel[] = [
      // Standard link with href
      {
        title: 'External Link',
        href: 'http://example.com/full',
        target: '_blank',
        origin: { datasourceUid: 'test' },
      },
      // Internal link with onClick handler
      {
        title: 'Internal Link',
        href: '', // Empty href for internal links
        onClick: jest.fn(),
        target: '_self',
        origin: { datasourceUid: 'test' },
      },
    ];

    const field: Field = {
      name: 'test',
      type: FieldType.string,
      config: {},
      values: ['value1'],
      getLinks: () => mockLinks,
    };

    const links = getCellLinks(field, 0);

    // Verify links are returned unmodified
    expect(links).toEqual(mockLinks);

    // Verify we have both types of links
    expect(links?.find((link) => link.onClick !== undefined)).toBeDefined();
    expect(links?.find((link) => link.href === 'http://example.com/full')).toBeDefined();
  });

  it('should bind the onClick handlers', () => {
    const onClickHandler = jest.fn();
    // Create links with different valid configurations
    const mockLinks: LinkModel[] = [
      // Internal link with onClick handler
      {
        title: 'Internal Link',
        href: '', // Empty href for internal links
        onClick: onClickHandler,
        target: '_self',
        origin: { datasourceUid: 'test' },
      },
    ];

    const field: Field = {
      name: 'test',
      type: FieldType.string,
      config: {},
      values: ['value1'],
      getLinks: () => mockLinks,
    };

    const links = getCellLinks(field, 0);

    const link = links?.[0];
    const event = new MouseEvent('click', { bubbles: true });
    jest.spyOn(event, 'preventDefault');

    link?.onClick?.(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(onClickHandler).toHaveBeenCalledWith(event, { field, rowIndex: 0 });
  });

  it.each([
    { keyName: 'metaKey', eventOverride: { metaKey: true } },
    { keyName: 'ctrlKey', eventOverride: { ctrlKey: true } },
    { keyName: 'shiftKey', eventOverride: { shiftKey: true } },
  ])(
    'should allow open a link in a new tab when $keyName clicked instead of using the handler',
    ({ eventOverride }) => {
      const onClickHandler = jest.fn();
      // Create links with different valid configurations
      const mockLinks: LinkModel[] = [
        // Internal link with onClick handler
        {
          title: 'Internal Link',
          href: '', // Empty href for internal links
          onClick: onClickHandler,
          target: '_self',
          origin: { datasourceUid: 'test' },
        },
      ];

      const field: Field = {
        name: 'test',
        type: FieldType.string,
        config: {},
        values: ['value1'],
        getLinks: () => mockLinks,
      };

      const links = getCellLinks(field, 0);

      const link = links?.[0];
      const event = new MouseEvent('click', { bubbles: true, ...eventOverride });
      jest.spyOn(event, 'preventDefault');

      link?.onClick?.(event);

      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(onClickHandler).not.toHaveBeenCalled();
    }
  );

  it('should filter out links which contain neither href nor onClick', () => {
    const field: Field = {
      name: 'test',
      type: FieldType.string,
      config: {},
      values: ['value1'],
      getLinks: (): LinkModel[] => [
        { title: 'Invalid Link', target: '_blank', origin: { datasourceUid: 'test' } } as LinkModel, // No href or onClick
      ],
    };

    const links = getCellLinks(field, 0);
    expect(links).toEqual([]);
  });
});

describe('displayJsonValue', () => {
  let field: Field;
  beforeEach(() => {
    field = {
      name: 'test',
      type: FieldType.string,
      config: {},
      state: { displayName: 'Test Display Name' },
      values: [],
      display: (val: unknown) => ({ text: String(val), numeric: NaN }),
    };
  });

  it('should parse and then stringify string values', () => {
    expect(displayJsonValue(field)('{"valid": "json"}').text).toBe('{\n "valid": "json"\n}');
  });

  it('should not throw for non-serializable string values', () => {
    expect(displayJsonValue(field)('{"invalid": "json').text).toBe('{"invalid": "json');
  });

  it('should stringify non-string values', () => {
    expect(displayJsonValue(field)(42).text).toBe('42');
  });

  it('should use the underlying field.display method to format values and return numeric values', () => {
    field.display = (val: unknown) => ({ text: `**${val}**`, numeric: Number(val), suffix: 'ms' });
    expect(displayJsonValue(field)(42).text).toBe('**42**ms');
    expect(displayJsonValue(field)(42).numeric).toBe(42);
  });

  it('should not mangle objects into [object Object]', () => {
    expect(displayJsonValue(field)({ a: 1, b: 2 }).text).toBe('{\n "a": 1,\n "b": 2\n}');
  });

  it('should render arrays as JSON', () => {
    expect(displayJsonValue(field)([1, 2, 3]).text).toBe('[\n 1,\n 2,\n 3\n]');
  });
});

describe('parseStyleJson', () => {
  it('parses the contents of the styleField for this row and returns a style object', () => {
    expect(parseStyleJson('{"color":"red"}')).toEqual({ color: 'red' });
  });

  it.each([
    { type: 'number', value: 12345 },
    { type: 'boolean', value: true },
    { type: 'null', value: null },
    { type: 'undefined', value: undefined },
    { type: 'object', value: { color: 'red' } },
    { type: 'array', value: ['not', 'a', 'string'] },
  ])('returns void if input is a $type', ({ value }) => {
    expect(parseStyleJson(value)).toBeUndefined();
  });

  it.each([
    { type: 'array', value: '["not","an","object"]' },
    { type: 'string', value: '"just a string"' },
    { type: 'number', value: '12345' },
    { type: 'boolean', value: 'true' },
    { type: 'null', value: 'null' },
  ])('returns void and does not throw if the parsed JSON is a $type', ({ value }) => {
    expect(parseStyleJson(value)).toBeUndefined();
  });

  it('returns void and does not throw if this is invalid JSON (but it does console.error)', () => {
    jest.spyOn(console, 'error').mockImplementation();
    expect(parseStyleJson('{"mal": "formed}')).toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });

  it('only calls console.error once for a given malformed style', () => {
    jest.spyOn(console, 'error').mockImplementation();
    for (let i = 0; i < 100; i++) {
      parseStyleJson('{"mal": "formed-in-a-new-way}');
    }
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it('returns an object with invalid style properties, because we do not validate the style properties', () => {
    expect(parseStyleJson('{"notARealStyle": "someValue"}')).toEqual({ notARealStyle: 'someValue' });
  });
});

describe('prepareSparklineValue', () => {
  it('should return an array of numbers when given an array of numbers', () => {
    expect(
      prepareSparklineValue([1, 2, 3, 4, 5], {
        name: 'test',
        type: FieldType.number,
        values: [1, 2, 3, 4, 5],
        config: {},
      })
    ).toEqual({
      y: {
        name: `test-sparkline`,
        type: FieldType.number,
        values: [1, 2, 3, 4, 5],
        config: {},
      },
    });
  });

  it('should parse the x and y values from a dataframe', () => {
    const frame = createDataFrame({
      fields: [
        { name: 'x', type: FieldType.time, values: [0, 1000, 2000, 3000, 4000] },
        { name: 'y', type: FieldType.number, values: [10, 20, 30, 40, 50] },
      ],
    });
    expect(
      prepareSparklineValue(frame, {
        name: 'test',
        type: FieldType.frame,
        values: [frame],
        config: {},
      })
    ).toEqual({
      x: {
        name: 'x',
        type: FieldType.time,
        values: [0, 1000, 2000, 3000, 4000],
        config: {},
      },
      y: {
        name: 'y',
        type: FieldType.number,
        values: [10, 20, 30, 40, 50],
        config: {},
      },
    });
  });

  it('should return undefined for non-array and non-dataframe values', () => {
    expect(
      prepareSparklineValue('not an array or dataframe', {
        name: 'test',
        type: FieldType.string,
        values: ['a', 'b', 'c'],
        config: {},
      })
    ).toBeUndefined();
  });
});

describe('buildInspectValue', () => {
  const numberFieldWithNulls: Field = {
    name: 'numbers-with-nulls',
    type: FieldType.number,
    values: [0, 1, 2, null, NaN],
    config: {},
  };
  const stringField: Field = {
    name: 'string',
    type: FieldType.string,
    values: ['foo', 'bar', 'baz', null],
    config: {},
  };
  const jsonStringField: Field = {
    ...stringField,
    values: ['{"valid": "json"}', '{"invalid": "json', null, '{"another": "one"}'],
    config: { custom: { cellOptions: { type: TableCellDisplayMode.JSONView } } },
  };
  const booleanField: Field = {
    name: 'boolean-field',
    type: FieldType.boolean,
    values: [true, false, true],
    config: {},
  };
  const sparklineField: Field = {
    name: 'sparkline-field',
    type: FieldType.frame,
    values: [
      createDataFrame({
        fields: [
          { name: 'x', type: FieldType.time, values: [0, 1000, 2000] },
          { name: 'y', type: FieldType.number, values: [10, 20, 30] },
        ],
      }),
    ],
    config: {},
  };
  const sparklineFieldNoX: Field = {
    name: 'sparkline-field-no-x',
    type: FieldType.other,
    values: [[2, 4, 6, 8, 10]],
    config: {
      custom: { cellOptions: { type: TableCellDisplayMode.Sparkline } },
    },
  };
  const arrayField: Field = {
    name: 'array-field',
    type: FieldType.other,
    values: [
      ['foo', 'bar', 'baz'],
      ['one', 'two', 'three'],
    ],
    config: {},
  };
  const objectField: Field = {
    name: 'array-field',
    type: FieldType.other,
    values: [
      { foo: true, b: 'baz' },
      { foo: false, b: 'qux' },
    ],
    config: {},
  };
  const geoField: Field = {
    name: 'geo-field',
    type: FieldType.geo,
    values: [new Point([0, -74.1])],
    config: {},
  };
  const geoFieldInvalid: Field = {
    name: 'geo-field',
    type: FieldType.geo,
    values: ['6y4h9b'],
    config: {},
  };

  const formatGeometry = (val: Geometry) =>
    new WKT().writeGeometry(val, {
      featureProjection: 'EPSG:3857',
      dataProjection: 'EPSG:4326',
    });

  it.each([
    { name: 'numbers', input: { valueIdx: 0, field: numberFieldWithNulls } },
    { name: 'string', input: { valueIdx: 0, field: stringField } },
    { name: 'string w/ JSON', input: { valueIdx: 0, field: jsonStringField } },
    { name: 'string w/ JSON (invalid JSON)', input: { valueIdx: 1, field: jsonStringField } },
    { name: 'boolean', input: { valueIdx: 0, field: booleanField } },
    { name: 'NaN', input: { valueIdx: 4, field: numberFieldWithNulls } },
    { name: 'null', input: { valueIdx: 3, field: numberFieldWithNulls } },
    { name: 'null w/ JSON', input: { valueIdx: 2, field: jsonStringField } },
    { name: 'undefined', input: { valueIdx: 6, field: numberFieldWithNulls } },
    { name: 'sparkline', input: { valueIdx: 0, field: sparklineField } },
    { name: 'sparkline (no x)', input: { valueIdx: 0, field: sparklineFieldNoX } },
    { name: 'array', input: { valueIdx: 0, field: arrayField } },
    { name: 'object', input: { valueIdx: 0, field: objectField } },
    { name: 'geo', input: { valueIdx: 0, field: geoField, formatGeometry } },
    { name: 'geo w/out formatGeometry', input: { valueIdx: 0, field: geoField } },
    { name: 'geo w/ invalid format', input: { valueIdx: 0, field: geoFieldInvalid, formatGeometry } },
  ])('should handle $name', ({ input: { field, valueIdx = 0, formatGeometry } }) => {
    expect(buildInspectValue(field.values[valueIdx], field, formatGeometry)).toMatchSnapshot();
  });
});
