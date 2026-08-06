import { act, renderHook } from '@testing-library/react';

import { createDataFrame, FieldType } from '@grafana/data';

import { compileFrameToRecords } from '../utils/rows';

import { useFilteredRows, useNestedRows, useRowCompiler } from './rows';
import { setupData } from './testHelpers';

describe('useFilteredRows', () => {
  it('should correctly initialize with provided fields and rows', () => {
    const { fields, rows } = setupData();
    const { result } = renderHook(() => useFilteredRows(rows, fields));
    expect(result.current.rows[0].name).toBe('Alice');
  });

  it('should apply filters correctly', () => {
    const { fields, rows } = setupData();
    const { result } = renderHook(() => useFilteredRows(rows, fields));

    act(() => {
      result.current.setFilter({
        name: { filteredSet: new Set(['Alice']), displayName: 'name' },
      });
    });

    expect(result.current.rows.length).toBe(1);
    expect(result.current.rows[0].name).toBe('Alice');
  });

  it('should clear filters correctly', () => {
    const { fields, rows } = setupData();
    const { result } = renderHook(() => useFilteredRows(rows, fields));

    act(() => {
      result.current.setFilter({
        name: { filteredSet: new Set(['Alice']), displayName: 'name' },
      });
    });

    expect(result.current.rows.length).toBe(1);

    act(() => {
      result.current.setFilter({});
    });

    expect(result.current.rows.length).toBe(3);
  });
});

describe('useNestedRows', () => {
  it('should return the nested rows', () => {
    const { fields } = setupData();
    const frame = createDataFrame({
      fields: [
        { name: 'id', type: FieldType.string, values: ['1'], config: {} },
        { name: 'nested', type: FieldType.nestedFrames, values: [[createDataFrame({ fields })]], config: {} },
      ],
    });

    const frameToRecords = compileFrameToRecords(
      frame.fields.map((f) => f.name),
      'nested'
    );
    const parentRows = frameToRecords(frame);
    const { result } = renderHook(() =>
      useNestedRows(
        parentRows,
        frame.fields[1].values.map((v) => v[0]),
        true,
        'nested',
        {},
        []
      )
    );
    expect(result.current[0].raw[0].name).toBe('Alice');
    expect(result.current[0].raw[0].age).toBe(30);
    expect(result.current[0].raw[0].active).toBe(true);

    expect(result.current[0].raw[1].name).toBe('Bob');
    expect(result.current[0].raw[1].age).toBe(25);
    expect(result.current[0].raw[1].active).toBe(false);

    expect(result.current[0].raw[2].name).toBe('Charlie');
    expect(result.current[0].raw[2].age).toBe(35);
    expect(result.current[0].raw[2].active).toBe(true);
  });

  it('should apply sorting and filtering', () => {
    const { fields } = setupData();
    const frame = createDataFrame({
      fields: [
        { name: 'id', type: FieldType.string, values: ['1'], config: {} },
        { name: 'nested', type: FieldType.nestedFrames, values: [[createDataFrame({ fields })]], config: {} },
      ],
    });

    const frameToRecords = compileFrameToRecords(
      frame.fields.map((f) => f.name),
      'nested'
    );

    // parentIndex must be set on the filter entry — this is how the UI always scopes filters
    // for nested tables. Without it the filter is silently skipped (regression test).
    const { result } = renderHook(() =>
      useNestedRows(
        frameToRecords(frame),
        frame.fields[1].values[0],
        true,
        'nested',
        { 'name-0': { filteredSet: new Set(['Alice', 'Bob']), displayName: 'name', parentIndex: 0 } },
        [{ columnKey: 'age', direction: 'ASC' }]
      )
    );

    // filtering reduced raw (3 rows) to final (2 rows: Alice + Bob), sorted by age ASC
    expect(result.current[0].raw).toHaveLength(3);
    expect(result.current[0].final).toHaveLength(2);
    expect(result.current[0].final.map((r) => r['name'])).toEqual(['Bob', 'Alice']);
  });
});

describe('useRowCompiler', () => {
  it('returns a converter that maps a frame to rows with column getters and metadata', () => {
    const frame = createDataFrame({
      fields: [
        { name: 'time', type: FieldType.number, values: [1, 2] },
        { name: 'value', type: FieldType.string, values: ['a', 'b'] },
      ],
    });

    const { result } = renderHook(() => useRowCompiler(frame));
    const rows = result.current(frame);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ __depth: 0, __index: 0, time: 1, value: 'a' });
    expect(rows[1]).toMatchObject({ __depth: 0, __index: 1, time: 2, value: 'b' });
  });

  it('resolves column keys from the display name rather than the raw field name', () => {
    const frame = createDataFrame({
      fields: [{ name: 'raw', type: FieldType.number, values: [1] }],
    });
    // getDisplayName reads field.state.displayName; set it directly since
    // createDataFrame does not derive it from config here.
    frame.fields[0].state = { displayName: 'Display' };

    const { result } = renderHook(() => useRowCompiler(frame));
    const rows = result.current(frame);

    expect(rows[0].Display).toBe(1);
  });

  it('emits an expander placeholder row for non-empty nested frames and hides the nested column', () => {
    const child = createDataFrame({
      fields: [{ name: 'inner', type: FieldType.number, values: [10] }],
    });
    const frame = createDataFrame({
      fields: [
        { name: 'id', type: FieldType.string, values: ['x', 'y'] },
        { name: 'nested', type: FieldType.nestedFrames, values: [[child], undefined] },
      ],
    });

    const { result } = renderHook(() => useRowCompiler(frame, 'nested'));
    const rows = result.current(frame);

    // 'x' has a nested frame -> data row + expander placeholder; 'y' has none -> data row only.
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ __depth: 0, __index: 0, id: 'x' });
    expect(rows[1]).toMatchObject({ __depth: 1, __index: 0 });
    expect(rows[2]).toMatchObject({ __depth: 0, __index: 1, id: 'y' });
    // the nested-frames column is not exposed as a data key.
    expect(rows[0].nested).toBeUndefined();
  });

  it('tags rows with __parentIndex when a nested row index is passed to the converter', () => {
    const frame = createDataFrame({
      fields: [{ name: 'value', type: FieldType.number, values: [1, 2] }],
    });

    const { result } = renderHook(() => useRowCompiler(frame));
    const rows = result.current(frame, 7);

    expect(rows[0].__parentIndex).toBe(7);
    expect(rows[1].__parentIndex).toBe(7);
  });

  it('returns a stable converter across re-renders when field names are unchanged', () => {
    const frame = createDataFrame({
      fields: [{ name: 'value', type: FieldType.number, values: [1] }],
    });

    const { result, rerender } = renderHook(() => useRowCompiler(frame));
    const first = result.current;
    rerender();

    expect(result.current).toBe(first);
  });

  it('keeps the same converter when the frame identity changes but field names do not', () => {
    const makeFrame = () => createDataFrame({ fields: [{ name: 'value', type: FieldType.number, values: [1] }] });

    const { result, rerender } = renderHook(({ frame }) => useRowCompiler(frame), {
      initialProps: { frame: makeFrame() },
    });
    const first = result.current;

    rerender({ frame: makeFrame() });

    expect(result.current).toBe(first);
  });

  it('returns a new converter when the field display names change', () => {
    const frameA = createDataFrame({
      fields: [{ name: 'a', type: FieldType.number, values: [1] }],
    });
    const frameB = createDataFrame({
      fields: [{ name: 'b', type: FieldType.number, values: [1] }],
    });

    const { result, rerender } = renderHook(({ frame }) => useRowCompiler(frame), {
      initialProps: { frame: frameA },
    });
    const first = result.current;

    rerender({ frame: frameB });

    expect(result.current).not.toBe(first);
  });

  it('returns a new converter when nestedFramesFieldName changes', () => {
    const frame = createDataFrame({
      fields: [{ name: 'value', type: FieldType.number, values: [1] }],
    });

    const { result, rerender } = renderHook(
      ({ nestedName }: { nestedName?: string }) => useRowCompiler(frame, nestedName),
      { initialProps: { nestedName: undefined as string | undefined } }
    );
    const first = result.current;

    rerender({ nestedName: 'nested' });

    expect(result.current).not.toBe(first);
  });
});
