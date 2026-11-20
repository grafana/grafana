import { createTheme, type Field, FieldType, type LinkModel } from '@grafana/data';

import { TableCellDisplayMode } from '../types';

import { buildCellHeightMeasurers } from './cellHeightMeasurers';

describe('buildCellHeightMeasurers', () => {
  const theme = createTheme();
  const ctx = {
    fontFamily: 'sans-serif',
    letterSpacing: 0.15,
    ctx: {} as CanvasRenderingContext2D,
    measureHeight: jest.fn(() => 2),
    estimateHeight: jest.fn(() => 2),
    measureWidth: (text: string) => text.length * 8,
    avgCharWidth: 7,
    numericCharWidth: 7,
    monoCharWidth: 7,
  };

  it('sets up text height measurers for each text column if wrapping is on', () => {
    const fields: Field[] = [
      { name: 'Name', type: FieldType.string, values: [], config: { custom: { wrapText: true } } },
      {
        name: 'Address',
        type: FieldType.string,
        values: [],
        config: { custom: { wrapText: true } },
      },
    ];
    const measurers = buildCellHeightMeasurers(fields, ctx, theme);
    expect(measurers![0].measure).toEqual(expect.any(Function));
    expect(measurers![0].fieldIdxs).toEqual([0, 1]);
  });

  it('does not return the index of columns which are not wrapped', () => {
    const fields: Field[] = [
      { name: 'Name', type: FieldType.string, values: [], config: { custom: {} } },
      {
        name: 'Address',
        type: FieldType.string,
        values: [],
        config: { custom: { wrapText: true } },
      },
    ];

    const measurers = buildCellHeightMeasurers(fields, ctx, theme);
    expect(measurers![0].fieldIdxs).toEqual([1]);
  });

  it('sets up line counting for pills if present and wrapping is on', () => {
    const fields: Field[] = [
      {
        name: 'Tags',
        type: FieldType.string,
        values: ['tag1,tag2', 'tag3', '["tag4","tag5","tag6"]'],
        config: { custom: { wrapText: true, cellOptions: { type: TableCellDisplayMode.Pill } } },
      },
    ];
    const measurers = buildCellHeightMeasurers(fields, ctx, theme);
    // pills are measured precisely (the cheap estimate was removed because it mis-ranked columns)
    expect(measurers![0].measure).toEqual(expect.any(Function));
    expect(measurers![0].measure('tag1,tag2', 100, fields[0], 0, 22)).toEqual(expect.any(Number));
    expect(measurers![0].fieldIdxs).toEqual([0]);
  });

  it('sets up line counting for datalinks if present and wrapping is on', () => {
    const fields: Field[] = [
      {
        name: 'Links',
        type: FieldType.string,
        values: ['http://example.com/1', 'http://example.com/2'],
        config: { custom: { wrapText: true, cellOptions: { type: TableCellDisplayMode.DataLinks } } },
        getLinks: jest.fn((): LinkModel[] => [
          { title: 'Link 1', href: 'http://example.com/1', target: '_blank', origin: { datasourceUid: 'test' } },
          { title: 'Link 2', href: 'http://example.com/2', target: '_self', origin: { datasourceUid: 'test' } },
        ]),
      },
    ];
    const measurers = buildCellHeightMeasurers(fields, ctx, theme);
    expect(measurers![0].measure).toEqual(expect.any(Function));
    expect(measurers![0].measure('http://example.com/1', 100, fields[0], 0, 22)).toEqual(expect.any(Number));
    expect(measurers![0].fieldIdxs).toEqual([0]);
  });

  it('enables text counting for Time fields rendered by AutoCellRenderer', () => {
    const fields: Field[] = [
      { name: 'Name', type: FieldType.string, values: [], config: { custom: {} } },
      {
        name: 'Time',
        type: FieldType.time,
        values: [],
        config: { custom: { wrapText: true } },
        display: (v) => ({ text: '2024-03-26 14:30:00', numeric: v as number, color: undefined, title: undefined }),
      },
    ];

    const measurers = buildCellHeightMeasurers(fields, ctx, theme);
    // Time fields use AutoCellRenderer (same as string fields) and can produce long formatted strings
    expect(measurers).toBeDefined();
    expect(measurers![0].fieldIdxs).toEqual([1]);
  });

  it('enables text counting for Number fields rendered by AutoCellRenderer', () => {
    const fields: Field[] = [
      {
        name: 'Value',
        type: FieldType.number,
        values: [],
        config: { custom: { wrapText: true } },
        display: (v) => ({ text: String(v), numeric: v as number, color: undefined, title: undefined }),
      },
    ];

    const measurers = buildCellHeightMeasurers(fields, ctx, theme);
    expect(measurers).toBeDefined();
    expect(measurers![0].fieldIdxs).toEqual([0]);
  });

  it('does not enable text counting for non-AutoCellRenderer fields like Gauge', () => {
    const fields: Field[] = [
      { name: 'Name', type: FieldType.string, values: [], config: { custom: {} } },
      {
        name: 'Score',
        type: FieldType.number,
        values: [],
        config: { custom: { wrapText: true, cellOptions: { type: TableCellDisplayMode.Gauge } } },
      },
    ];

    const measurers = buildCellHeightMeasurers(fields, ctx, theme);
    // Gauge cells don't use AutoCellRenderer, so no measurer is set up
    expect(measurers).toBeUndefined();
  });

  it('returns an undefined if no columns are wrapped', () => {
    const fields: Field[] = [
      { name: 'Name', type: FieldType.string, values: [], config: { custom: {} } },
      { name: 'Age', type: FieldType.number, values: [], config: { custom: {} } },
    ];

    const measurers = buildCellHeightMeasurers(fields, ctx, theme);
    expect(measurers).toBeUndefined();
  });

  it('clamps by maxHeight if set', () => {
    const fields: Field[] = [
      {
        name: 'Tags',
        type: FieldType.string,
        values: ['tag1,tag2', 'tag3', '["tag4","tag5","tag6"]'],
        config: { custom: { wrapText: true, cellOptions: { type: TableCellDisplayMode.Pill } } },
      },
    ];
    const measurers = buildCellHeightMeasurers(fields, ctx, theme);
    expect(measurers![0].measure!(fields[0].values[2], 20, fields[0], 2, 100)).toBeGreaterThan(50);

    fields[0].config!.custom!.maxHeight = 50;
    const measurersWithMax = buildCellHeightMeasurers(fields, ctx, theme, 50);
    expect(measurersWithMax![0].measure!(fields[0].values[2], 20, fields[0], 2, 100)).toBe(50);
  });
});
