import { lastValueFrom } from 'rxjs';

import { cacheFieldDisplayNames, createDataFrame, FieldType, transformDataFrame, type DataFrame } from '@grafana/data';
import { mockTransformationsRegistry, organizeFieldsTransformer } from '@grafana/data/internal';

import { getSourceFrameIndex, prepareColumnContext } from './columnContext';
import { columnTransformations } from './registry';

describe('getSourceFrameIndex', () => {
  it.each([
    {
      name: 'matches a unique refId after frame order changes',
      frames: ['B', 'A'],
      sources: ['A', 'B'],
      index: 0,
      expected: 1,
    },
    {
      name: 'matches a single frame without a refId',
      frames: [undefined],
      sources: [undefined],
      index: 0,
      expected: 0,
    },
    { name: 'rejects a missing output frame', frames: ['A'], sources: ['A'], index: 1, expected: -1 },
    { name: 'rejects a missing source match', frames: ['A'], sources: ['B'], index: 0, expected: -1 },
    { name: 'rejects an empty source list', frames: ['A'], sources: [], index: 0, expected: -1 },
    { name: 'rejects duplicate output refIds', frames: ['A', 'A'], sources: ['A'], index: 0, expected: -1 },
    { name: 'rejects duplicate source refIds', frames: ['A'], sources: ['A', 'A'], index: 0, expected: -1 },
    {
      name: 'rejects ambiguous missing refIds',
      frames: [undefined, undefined],
      sources: [undefined],
      index: 0,
      expected: -1,
    },
  ])('$name', ({ frames, sources, index, expected }) => {
    const outputFrames = frames.map((refId) => createDataFrame({ refId, fields: [] }));
    const sourceFrames = sources.map((refId) => createDataFrame({ refId, fields: [] }));

    expect(getSourceFrameIndex(outputFrames, index, sourceFrames)).toBe(expected);
  });
});

describe('prepareColumnContext', () => {
  const source = createDataFrame({
    refId: 'A',
    fields: [
      { name: 'customer_id', type: FieldType.string, values: ['customer-a'] },
      { name: 'secret', type: FieldType.string, values: ['x'], config: { custom: { hideFrom: { viz: true } } } },
      { name: 'region_name', type: FieldType.string, values: ['us-east'] },
    ],
  });
  const renamed = (frame: DataFrame, ...displayNames: Array<string | undefined>): DataFrame => ({
    ...frame,
    fields: frame.fields.map((field, index) => ({
      ...field,
      config: { ...field.config, displayName: displayNames[index] },
    })),
  });
  const asTableShows = (frames: DataFrame[]): DataFrame[] => {
    const shown = frames.map((frame) => ({
      ...frame,
      fields: frame.fields.map((field) => ({ ...field, state: undefined })),
    }));
    cacheFieldDisplayNames(shown);
    return shown;
  };

  it('pairs visible source columns with the names the table shows, ignoring hidden ones', () => {
    expect(prepareColumnContext([source], 0, asTableShows([renamed(source, 'Customer', 'Region', 'Region')]))).toEqual({
      catalog: ['customer_id', 'region_name'],
      displayNames: ['Customer', 'Region'],
      frameFilter: { id: 'byRefId', options: 'A' },
    });
  });

  it('pairs the columns of the selected frame when there are several', () => {
    const hosts = createDataFrame({
      refId: 'B',
      fields: [{ name: 'host_name', type: FieldType.string, values: ['web-01'] }],
    });
    const display = asTableShows([renamed(source, 'Customer', undefined, 'Region'), renamed(hosts, 'Host')]);

    expect(prepareColumnContext([source, hosts], 1, display)).toEqual({
      catalog: ['host_name'],
      displayNames: ['Host'],
      frameFilter: { id: 'byRefId', options: 'B' },
    });
  });

  it('names source columns the way the organize transformation for their frame matches them', async () => {
    mockTransformationsRegistry([organizeFieldsTransformer]);
    const alpha = createDataFrame({
      refId: 'A',
      name: 'Alpha',
      fields: [{ name: 'customer_id', type: FieldType.string, values: ['customer-a'] }],
    });
    const beta = createDataFrame({
      refId: 'B',
      name: 'Beta',
      fields: ['host_name', 'cpu', 'customer_id'].map((name) => ({ name, type: FieldType.string, values: ['x'] })),
    });
    const context = prepareColumnContext([alpha, beta], 1, asTableShows([alpha, beta]))!;
    const { columnOrder, columnVisibility } = columnTransformations;
    const hidden = columnVisibility.write([], new Set(['Beta host_name']), context);
    const configs = columnOrder.write(hidden, ['Beta customer_id', 'Beta host_name', 'Beta cpu'], context);

    expect(context.catalog).toEqual(['host_name', 'cpu', 'customer_id']);
    expect(context.displayNames).toEqual(['Beta host_name', 'Beta cpu', 'Beta customer_id']);
    const output = await lastValueFrom(transformDataFrame([...configs], [alpha, beta]));
    expect(output.map((frame) => frame.fields.map((field) => field.name))).toEqual([
      ['customer_id'],
      ['customer_id', 'cpu'],
    ]);
  });

  it('numbers repeated field names the way the organize transformation does', () => {
    const repeated = createDataFrame({
      refId: 'A',
      fields: [1, 2].map((value) => ({ name: 'value', type: FieldType.number, values: [value] })),
    });

    expect(prepareColumnContext([repeated], 0)?.catalog).toEqual(['value 1', 'value 2']);
  });

  it('shows source names when there is no display series', () => {
    expect(prepareColumnContext([source], 0)?.displayNames).toEqual(['customer_id', 'region_name']);
  });

  it.each([
    {
      name: 'two columns are shown under one name',
      display: asTableShows([renamed(source, 'Name', undefined, 'Name')]),
    },
    { name: 'a column is shown under the name of another', display: asTableShows([renamed(source, 'region_name')]) },
    { name: 'the display frame has different fields', display: [{ ...source, fields: source.fields.slice(1) }] },
    { name: 'the display series has no frame at that index', display: [] },
  ])('cannot manage columns when $name', ({ display }) => {
    expect(prepareColumnContext([source], 0, display)).toBeUndefined();
  });
});
