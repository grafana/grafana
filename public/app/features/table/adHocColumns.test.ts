import { FieldType, getFrameMatchers, toDataFrame, type DataTransformerConfig } from '@grafana/data';

import { decodeAdHocColumns, encodeHiddenColumns, findColumnsEntry, frameFilterFor } from './adHocColumns';

const CATALOG = ['A', 'B', 'C'];

const organize = (options: object): DataTransformerConfig => ({ id: 'organize', options });
const unrelated: DataTransformerConfig = { id: 'filterByValue', options: { filters: [] } };

describe('decodeAdHocColumns', () => {
  it('treats an organize transformation without options as an unchanged view', () => {
    expect(decodeAdHocColumns([{ id: 'organize', options: undefined }], CATALOG)).toEqual({
      hiddenColumns: new Set(),
    });
  });

  it('reads an empty transformations as no ad-hoc view', () => {
    expect(decodeAdHocColumns([], CATALOG)).toEqual({ hiddenColumns: new Set() });
  });

  it('reads an exclusion set to false as visible', () => {
    const state = decodeAdHocColumns([organize({ excludeByName: { A: true, B: false } })], CATALOG);

    expect(state.hiddenColumns).toEqual(new Set(['A']));
  });
});

describe('encodeHiddenColumns', () => {
  it('leaves unrelated transformations intact when clearing an absent column entry', () => {
    expect(encodeHiddenColumns([unrelated], new Set())).toEqual([unrelated]);
  });

  it('preserves renames when the last hidden column is restored', () => {
    const transformations = [organize({ excludeByName: { B: true }, renameByName: { A: 'Alpha' } })];

    expect(encodeHiddenColumns(transformations, new Set())).toEqual([
      organize({ indexByName: {}, excludeByName: {}, renameByName: { A: 'Alpha' } }),
    ]);
  });

  it('adds and removes hidden column names', () => {
    const hidden = encodeHiddenColumns([], new Set(['B']));

    expect(findColumnsEntry(hidden)!.options.excludeByName).toEqual({ B: true });
    expect(encodeHiddenColumns(hidden, new Set())).toEqual([]);
  });

  it('removes the entry once it says nothing, leaving other entries alone', () => {
    const transformations = encodeHiddenColumns([unrelated], new Set(['B']));

    expect(transformations).toHaveLength(2);
    expect(encodeHiddenColumns(transformations, new Set())).toEqual([unrelated]);
  });

  it('leaves other entries in place and in order', () => {
    const transformations = encodeHiddenColumns([unrelated], new Set(['B']));

    expect(transformations[0]).toBe(unrelated);
  });

  it('does not mutate the transformations it was given', () => {
    const transformations = encodeHiddenColumns([], new Set(['B']));
    const before = JSON.stringify(transformations);

    encodeHiddenColumns(transformations, new Set(['B', 'A']));

    expect(JSON.stringify(transformations)).toBe(before);
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
    const transformations = encodeHiddenColumns(
      encodeHiddenColumns([], new Set(['B']), frameA),
      new Set(['C']),
      frameB
    );

    expect(decodeAdHocColumns(transformations, CATALOG, frameA).hiddenColumns).toEqual(new Set(['B']));
    expect(decodeAdHocColumns(transformations, CATALOG, frameB).hiddenColumns).toEqual(new Set(['C']));
  });

  it('does not read a frame-scoped entry as the unscoped one', () => {
    const transformations = encodeHiddenColumns([], new Set(['B']), frameA);

    expect(decodeAdHocColumns(transformations, CATALOG).hiddenColumns).toEqual(new Set());
  });

  it('updates the entry for its own frame rather than another frame’s', () => {
    const transformations = encodeHiddenColumns(
      encodeHiddenColumns([], new Set(['B']), frameA),
      new Set(['C']),
      frameB
    );
    const updated = encodeHiddenColumns(transformations, new Set(['B', 'C']), frameB);

    expect(updated).toHaveLength(2);
    expect(decodeAdHocColumns(updated, CATALOG, frameA).hiddenColumns).toEqual(new Set(['B']));
    expect(decodeAdHocColumns(updated, CATALOG, frameB).hiddenColumns).toEqual(new Set(['B', 'C']));
  });

  it('removes only its own frame’s entry when it is emptied', () => {
    const transformations = encodeHiddenColumns(
      encodeHiddenColumns([], new Set(['B']), frameA),
      new Set(['C']),
      frameB
    );
    const cleared = encodeHiddenColumns(transformations, new Set(), frameB);

    expect(cleared).toHaveLength(1);
    expect(cleared[0].filter).toEqual(frameA);
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
    const transformations = encodeHiddenColumns([], new Set(['B']), { id: 'byRefId', options: 'B' });

    expect(transformations[0].filter).toEqual({ id: 'byRefId', options: 'B' });
  });
});
