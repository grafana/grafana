import { act, renderHook } from '@testing-library/react';

import { FieldType, type Field } from '@grafana/data';

import { useColWidths, useNestedColWidths } from './width';

describe('useNestedColWidths', () => {
  function makeFields(names: string[], width = 100): Field[] {
    return names.map((name) => ({
      name,
      type: FieldType.string,
      config: { custom: { width } },
      values: [],
    }));
  }

  it('initializes nestedFieldWidths and nestedColWidths from schema', () => {
    const fields = makeFields(['a', 'b']);
    const { result } = renderHook(() => useNestedColWidths({ nestedVisibleFields: fields, availableWidth: 300 }));

    expect(result.current.nestedFieldWidths).toEqual([100, 100]);
    expect(result.current.nestedColWidths.get('a')).toEqual({ type: 'resized', width: 100 });
    expect(result.current.nestedColWidths.get('b')).toEqual({ type: 'resized', width: 100 });
  });

  it('re-flows auto (unconfigured) column widths when the panel width changes', () => {
    const fields: Field[] = ['a', 'b'].map((name) => ({ name, type: FieldType.string, config: {}, values: [] }));
    const { result, rerender } = renderHook(
      ({ availableWidth }: { availableWidth: number }) =>
        useNestedColWidths({ nestedVisibleFields: fields, availableWidth }),
      { initialProps: { availableWidth: 300 } }
    );

    const before = [...result.current.nestedFieldWidths];
    rerender({ availableWidth: 600 });
    const after = result.current.nestedFieldWidths;

    // widening the panel widens the auto-sized nested columns (previously they stayed put until a
    // structure change, so they ignored panel resize).
    expect(after[0]).toBeGreaterThan(before[0]);
    expect(after[1]).toBeGreaterThan(before[1]);
  });

  it('preserves a manual nested resize across a panel resize before it persists to config', () => {
    const fields = makeFields(['a', 'b']); // configured width 100 each
    const { result, rerender } = renderHook(
      ({ availableWidth }: { availableWidth: number }) =>
        useNestedColWidths({ nestedVisibleFields: fields, availableWidth }),
      { initialProps: { availableWidth: 300 } }
    );

    // user drags column 'a' — local widths update immediately; config persists later on pointer-up.
    act(() => {
      result.current.handleNestedColumnWidthsChange(new Map([['a', { type: 'resized', width: 250 }]]));
    });
    expect(result.current.nestedFieldWidths[0]).toBe(250);

    // a panel resize lands before the drag persists — it must not overwrite the in-progress resize.
    rerender({ availableWidth: 600 });
    expect(result.current.nestedFieldWidths[0]).toBe(250);
  });

  it('handleNestedColumnWidthsChange updates nestedFieldWidths and nestedColWidths', () => {
    const fields = makeFields(['a', 'b']);
    const { result } = renderHook(() => useNestedColWidths({ nestedVisibleFields: fields, availableWidth: 300 }));

    act(() => {
      result.current.handleNestedColumnWidthsChange(
        new Map([
          ['a', { type: 'resized', width: 200 }],
          ['b', { type: 'resized', width: 150 }],
        ])
      );
    });

    expect(result.current.nestedFieldWidths).toEqual([200, 150]);
    expect(result.current.nestedColWidths.get('a')).toEqual({ type: 'resized', width: 200 });
    expect(result.current.nestedColWidths.get('b')).toEqual({ type: 'resized', width: 150 });
  });

  it('handleNestedColumnWidthsChange preserves existing width for missing columns', () => {
    const fields = makeFields(['a', 'b']);
    const { result } = renderHook(() => useNestedColWidths({ nestedVisibleFields: fields, availableWidth: 300 }));

    act(() => {
      // only update 'a', leave 'b' absent from the map
      result.current.handleNestedColumnWidthsChange(new Map([['a', { type: 'resized', width: 250 }]]));
    });

    expect(result.current.nestedFieldWidths).toEqual([250, 100]);
  });

  it('resets to schema widths when field schema changes', () => {
    const fields = makeFields(['a', 'b']);
    const { result, rerender } = renderHook(
      ({ nestedVisibleFields, structureRev }: { nestedVisibleFields: Field[]; structureRev: number }) =>
        useNestedColWidths({ nestedVisibleFields, availableWidth: 300, structureRev }),
      { initialProps: { nestedVisibleFields: fields, structureRev: 1 } }
    );

    // simulate a user drag
    act(() => {
      result.current.handleNestedColumnWidthsChange(
        new Map([
          ['a', { type: 'resized', width: 200 }],
          ['b', { type: 'resized', width: 200 }],
        ])
      );
    });
    expect(result.current.nestedFieldWidths).toEqual([200, 200]);

    // now the field schema changes (different configured width) — structureRev bumped to signal the change
    const newFields = makeFields(['a', 'b'], 120);
    rerender({ nestedVisibleFields: newFields, structureRev: 2 });

    expect(result.current.nestedFieldWidths).toEqual([120, 120]);
  });

  it('resets when a new field is added', () => {
    const fields = makeFields(['a', 'b']);
    const { result, rerender } = renderHook(
      ({ nestedVisibleFields, structureRev }: { nestedVisibleFields: Field[]; structureRev: number }) =>
        useNestedColWidths({ nestedVisibleFields, availableWidth: 300, structureRev }),
      { initialProps: { nestedVisibleFields: fields, structureRev: 1 } }
    );

    // simulate a user drag on the original columns
    act(() => {
      result.current.handleNestedColumnWidthsChange(
        new Map([
          ['a', { type: 'resized', width: 200 }],
          ['b', { type: 'resized', width: 200 }],
        ])
      );
    });

    const fieldsWithExtra = makeFields(['a', 'b', 'c']);
    rerender({ nestedVisibleFields: fieldsWithExtra, structureRev: 2 });

    expect(result.current.nestedFieldWidths).toHaveLength(3);
    expect(result.current.nestedFieldWidths).toEqual([100, 100, 100]);
  });

  it('does not reset on re-render if schema is unchanged (stable between drags)', () => {
    const fields = makeFields(['a', 'b']);
    const { result, rerender } = renderHook(
      ({ nestedVisibleFields, availableWidth }: { nestedVisibleFields: Field[]; availableWidth: number }) =>
        useNestedColWidths({ nestedVisibleFields, availableWidth }),
      { initialProps: { nestedVisibleFields: fields, availableWidth: 300 } }
    );

    act(() => {
      result.current.handleNestedColumnWidthsChange(
        new Map([
          ['a', { type: 'resized', width: 200 }],
          ['b', { type: 'resized', width: 200 }],
        ])
      );
    });
    expect(result.current.nestedFieldWidths).toEqual([200, 200]);

    // rerender with same fields reference — state must be preserved
    rerender({ nestedVisibleFields: fields, availableWidth: 300 });

    expect(result.current.nestedFieldWidths).toEqual([200, 200]);
  });
});

describe('useColWidths', () => {
  function makeFields(names: string[]): Field[] {
    return names.map((name) => ({
      name,
      type: FieldType.string,
      config: {},
      values: [],
    }));
  }

  it('recomputes widths when reset key changes without new field objects', () => {
    const fields = makeFields(['a', 'b']);
    const { result, rerender } = renderHook(
      ({ resetKey }: { resetKey?: symbol }) => useColWidths(fields, 600, undefined, resetKey),
      { initialProps: { resetKey: undefined as symbol | undefined } }
    );

    expect(result.current[0]).toEqual([300, 300]);

    fields[0].config.custom = { width: 100 };
    rerender({ resetKey: Symbol() });
    expect(result.current[0]).toEqual([100, 500]);

    fields[0].config.custom = {};
    rerender({ resetKey: Symbol() });

    expect(result.current[0]).toEqual([300, 300]);
  });
});
