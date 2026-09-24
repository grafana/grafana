import { FieldType, getFrameMatchers, toDataFrame, type DataTransformerConfig } from '@grafana/data';

import {
  decodeAdHocColumns,
  encodeColumnOrder,
  encodeHiddenColumns,
  findColumnsEntry,
  frameFilterFor,
} from './adHocColumns';

const CATALOG = ['A', 'B', 'C'];

const organize = (options: object): DataTransformerConfig => ({ id: 'organize', options });
const unrelated: DataTransformerConfig = { id: 'filterByValue', options: { filters: [] } };

describe('decodeAdHocColumns', () => {
  it('reads an empty stage as no ad-hoc view', () => {
    expect(decodeAdHocColumns([], CATALOG)).toEqual({ columnOrder: undefined, hiddenColumns: new Set() });
  });

  it('leaves the order undefined when nothing has been reordered', () => {
    expect(decodeAdHocColumns([organize({ excludeByName: { B: true } })], CATALOG).columnOrder).toBeUndefined();
  });

  it('orders the catalog by the index map', () => {
    const state = decodeAdHocColumns([organize({ indexByName: { C: 0, A: 1, B: 2 } })], CATALOG);

    expect(state.columnOrder).toEqual(['C', 'A', 'B']);
  });

  it('appends a column the index map does not mention, in catalog order', () => {
    const state = decodeAdHocColumns([organize({ indexByName: { C: 0, A: 1 } })], ['A', 'B', 'C', 'D']);

    expect(state.columnOrder).toEqual(['C', 'A', 'B', 'D']);
  });

  it('reads an exclusion set to false as visible', () => {
    const state = decodeAdHocColumns([organize({ excludeByName: { A: true, B: false } })], CATALOG);

    expect(state.hiddenColumns).toEqual(new Set(['A']));
  });

  it('does not mutate the catalog it was given', () => {
    const catalog = [...CATALOG];

    decodeAdHocColumns([organize({ indexByName: { C: 0, A: 1, B: 2 } })], catalog);

    expect(catalog).toEqual(CATALOG);
  });
});

describe('encodeColumnOrder', () => {
  it('adds one entry carrying the whole order', () => {
    const stage = encodeColumnOrder([], ['C', 'A', 'B']);

    expect(stage).toEqual([organize({ excludeByName: {}, renameByName: {}, indexByName: { C: 0, A: 1, B: 2 } })]);
  });

  it('updates the existing entry rather than appending another', () => {
    const first = encodeColumnOrder([], ['C', 'A', 'B']);
    const second = encodeColumnOrder(first, ['A', 'B', 'C']);

    expect(second).toHaveLength(1);
    expect(findColumnsEntry(second)!.options.indexByName).toEqual({ A: 0, B: 1, C: 2 });
  });

  it('preserves hidden columns when updating the order', () => {
    const hidden = encodeHiddenColumns([], new Set(['B']));
    const reordered = encodeColumnOrder(hidden, ['C', 'A', 'B']);

    expect(decodeAdHocColumns(reordered, CATALOG)).toEqual({
      columnOrder: ['C', 'A', 'B'],
      hiddenColumns: new Set(['B']),
    });
  });

  it('preserves organize options it does not own', () => {
    const withRename = [organize({ renameByName: { A: 'Alpha' } })];

    expect(findColumnsEntry(encodeColumnOrder(withRename, CATALOG))!.options.renameByName).toEqual({ A: 'Alpha' });
  });
});

describe('encodeHiddenColumns', () => {
  it('adds and removes hidden column names', () => {
    const hidden = encodeHiddenColumns([], new Set(['B']));

    expect(findColumnsEntry(hidden)!.options.excludeByName).toEqual({ B: true });
    expect(encodeHiddenColumns(hidden, new Set())).toEqual([]);
  });

  it('preserves column order when updating visibility', () => {
    const ordered = encodeColumnOrder([], ['C', 'A', 'B']);
    const hidden = encodeHiddenColumns(ordered, new Set(['A']));

    expect(decodeAdHocColumns(hidden, CATALOG)).toEqual({
      columnOrder: ['C', 'A', 'B'],
      hiddenColumns: new Set(['A']),
    });
  });

  it('removes the entry once it says nothing, leaving other entries alone', () => {
    const stage = encodeHiddenColumns([unrelated], new Set(['B']));

    expect(stage).toHaveLength(2);
    expect(encodeHiddenColumns(stage, new Set())).toEqual([unrelated]);
  });

  it('leaves other entries in place and in order', () => {
    const stage = encodeHiddenColumns([unrelated], new Set(['B']));

    expect(stage[0]).toBe(unrelated);
  });

  it('does not mutate the stage it was given', () => {
    const stage = encodeHiddenColumns([], new Set(['B']));
    const before = JSON.stringify(stage);

    encodeHiddenColumns(stage, new Set(['B', 'A']));

    expect(JSON.stringify(stage)).toBe(before);
  });
});

describe('frame scoping', () => {
  const frameA = { id: 'byRefId', options: 'A' };
  const frameB = { id: 'byRefId', options: 'B' };

  it('keeps a separate entry per frame', () => {
    const withA = encodeHiddenColumns([], new Set(['B']), frameA);
    const withBoth = encodeHiddenColumns(withA, new Set(['C']), frameB);

    expect(withBoth).toHaveLength(2);
    expect(withBoth.map((config) => config.filter)).toEqual([frameA, frameB]);
  });

  it('reads back only the entry for the frame asked about', () => {
    const stage = encodeHiddenColumns(encodeHiddenColumns([], new Set(['B']), frameA), new Set(['C']), frameB);

    expect(decodeAdHocColumns(stage, CATALOG, frameA).hiddenColumns).toEqual(new Set(['B']));
    expect(decodeAdHocColumns(stage, CATALOG, frameB).hiddenColumns).toEqual(new Set(['C']));
  });

  it('does not read a frame-scoped entry as the unscoped one', () => {
    const stage = encodeHiddenColumns([], new Set(['B']), frameA);

    expect(decodeAdHocColumns(stage, CATALOG).hiddenColumns).toEqual(new Set());
  });

  it('updates the entry for its own frame rather than another frame’s', () => {
    const stage = encodeHiddenColumns(encodeHiddenColumns([], new Set(['B']), frameA), new Set(['C']), frameB);
    const updated = encodeHiddenColumns(stage, new Set(['B', 'C']), frameB);

    expect(updated).toHaveLength(2);
    expect(decodeAdHocColumns(updated, CATALOG, frameA).hiddenColumns).toEqual(new Set(['B']));
    expect(decodeAdHocColumns(updated, CATALOG, frameB).hiddenColumns).toEqual(new Set(['B', 'C']));
  });

  it('removes only its own frame’s entry when it is emptied', () => {
    const stage = encodeHiddenColumns(encodeHiddenColumns([], new Set(['B']), frameA), new Set(['C']), frameB);
    const cleared = encodeHiddenColumns(stage, new Set(), frameB);

    expect(cleared).toHaveLength(1);
    expect(cleared[0].filter).toEqual(frameA);
  });
});

describe('round trip', () => {
  it('round-trips column order and visibility', () => {
    const stage = encodeHiddenColumns(encodeColumnOrder([], ['B', 'C', 'A']), new Set(['C']));

    expect(decodeAdHocColumns(stage, CATALOG)).toEqual({
      columnOrder: ['B', 'C', 'A'],
      hiddenColumns: new Set(['C']),
    });
  });
});

describe('frameFilterFor', () => {
  const frame = (refId?: string) =>
    toDataFrame({ refId, fields: [{ name: 'A', type: FieldType.number, values: [1] }] });

  it('does not scope a single frame', () => {
    expect(frameFilterFor([frame('A')], 0)).toBeUndefined();
  });

  it('scopes to the selected frame when there are several', () => {
    expect(frameFilterFor([frame('A'), frame('B')], 1)).toEqual({ id: 'byRefId', options: 'B' });
  });

  it('produces a filter the frame matcher registry can resolve', () => {
    const frames = [frame('A'), frame('B')];
    const matches = getFrameMatchers(frameFilterFor(frames, 1)!);

    expect(matches(frames[1])).toBe(true);
    expect(matches(frames[0])).toBe(false);
  });

  it('does not scope when the frames have no refId to scope by', () => {
    expect(frameFilterFor([frame(), frame()], 0)).toBeUndefined();
  });

  it('writes the filter to the encoded entry', () => {
    const stage = encodeHiddenColumns([], new Set(['B']), { id: 'byRefId', options: 'B' });

    expect(stage[0].filter).toEqual({ id: 'byRefId', options: 'B' });
  });
});
