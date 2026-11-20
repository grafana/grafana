import { type DataTransformerConfig } from '@grafana/data';

import { columnTransformations } from './registry';

const context = { catalog: ['A', 'B', 'C', 'D'] };
const { columnOrder, columnVisibility } = columnTransformations;

it('preserves source order until the user reorders', () => {
  expect(columnOrder.read([], context).columnOrder).toBeUndefined();
  expect(columnOrder.read([{ id: 'organize', options: undefined }], context).columnOrder).toBeUndefined();
  expect(columnOrder.read(columnVisibility.write([], new Set(['B']), context), context).columnOrder).toBeUndefined();
});

it('orders known columns and places new columns by their upstream neighbors without mutating the catalog', () => {
  const configs = columnOrder.write([], ['C', 'A'], context);
  expect(columnOrder.read(configs, context).columnOrder).toEqual(['C', 'D', 'A', 'B']);
  expect(context.catalog).toEqual(['A', 'B', 'C', 'D']);
  expect(configs).toEqual([
    {
      id: 'organize',
      options: { indexByName: { C: 0, A: 1 }, excludeByName: {}, renameByName: {} },
    },
  ]);
});

it('places added columns by their upstream neighbors without disturbing the viewer order', () => {
  const configs = columnOrder.write([], ['C', 'A', 'B', 'D'], context);

  expect(columnOrder.read(configs, { catalog: ['Before', 'A', 'New 1', 'New 2', 'B', 'C', 'D'] }).columnOrder).toEqual([
    'C',
    'Before',
    'A',
    'New 1',
    'New 2',
    'B',
    'D',
  ]);
  expect(columnOrder.read(configs, { catalog: ['A', 'C', 'D'] }).columnOrder).toEqual(['C', 'A', 'D']);
  expect(columnOrder.read(configs, context).columnOrder).toEqual(['C', 'A', 'B', 'D']);
});

it('updates one organize entry while preserving visibility, renames, and unrelated transformations', () => {
  const unrelated: DataTransformerConfig = { id: 'filterByValue', options: { filters: [] } };
  const initial = [unrelated, { id: 'organize', options: { renameByName: { A: 'Alpha' } } }];
  const hidden = columnVisibility.write(initial, new Set(['B']), context);
  const ordered = columnOrder.write(hidden, ['C', 'A', 'B', 'D'], context);
  const reordered = columnOrder.write(ordered, ['B', 'C', 'A', 'D'], context);
  const visible = columnVisibility.write(reordered, new Set(), context);

  expect(visible).toEqual([
    unrelated,
    {
      id: 'organize',
      options: { indexByName: { B: 0, C: 1, A: 2, D: 3 }, excludeByName: {}, renameByName: { A: 'Alpha' } },
    },
  ]);
  expect(columnVisibility.read(ordered, context).hiddenColumns).toEqual(new Set(['B']));
  expect(columnOrder.read(visible, context).columnOrder).toEqual(['B', 'C', 'A', 'D']);
  expect(initial).toEqual([unrelated, { id: 'organize', options: { renameByName: { A: 'Alpha' } } }]);
});

describe('with display names', () => {
  const rotated = { catalog: ['a', 'b', 'c'], displayNames: ['b', 'c', 'a'] };
  const renamed = { catalog: ['customer_id', 'region_name'], displayNames: ['Customer', 'Region'] };

  it('reads columns by the names the table shows and writes them by source name', () => {
    const hidden = columnVisibility.write([], new Set(['b']), rotated);
    const ordered = columnOrder.write(hidden, ['a', 'b', 'c'], rotated);

    expect(ordered).toEqual([
      {
        id: 'organize',
        options: { indexByName: { c: 0, a: 1, b: 2 }, excludeByName: { a: true }, renameByName: {} },
      },
    ]);
    expect(columnVisibility.read(ordered, rotated).hiddenColumns).toEqual(new Set(['b']));
    expect(columnOrder.read(ordered, rotated).columnOrder).toEqual(['a', 'b', 'c']);
  });

  it('keeps hidden names outside the catalog without showing them to the table', () => {
    const configs = [{ id: 'organize', options: { excludeByName: { Customer: true, region_name: true } } }];

    expect(columnVisibility.read(configs, renamed).hiddenColumns).toEqual(new Set(['Region']));
    expect(columnVisibility.write(configs, new Set(['Customer']), renamed)).toEqual([
      {
        id: 'organize',
        options: { indexByName: {}, excludeByName: { Customer: true, customer_id: true }, renameByName: {} },
      },
    ]);
  });

  it('drops names the table does not show', () => {
    expect(columnOrder.write([], ['Region', 'customer_id'], renamed)).toEqual([
      { id: 'organize', options: { indexByName: { region_name: 0 }, excludeByName: {}, renameByName: {} } },
    ]);
    expect(columnVisibility.write([], new Set(['region_name']), renamed)).toEqual([]);
  });
});
