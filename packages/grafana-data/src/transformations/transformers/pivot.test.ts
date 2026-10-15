import { lastValueFrom, of } from 'rxjs';

import { toDataFrame } from '../../dataframe/processDataFrame';
import { FieldType } from '../../types/dataFrame';

import { getPivotProvenance, pivotFooter, pivotFrame, pivotTransformer, type PivotOptions } from './pivot';

function source() {
  return toDataFrame({
    fields: [
      { name: 'Region', type: FieldType.string, values: ['East', 'East', 'East', 'West', 'West'] },
      { name: 'Period', type: FieldType.string, values: ['Jan', 'Jan', 'Feb', 'Jan', 'Jan'] },
      { name: 'Product', type: FieldType.string, values: ['A', 'A', 'B', 'A', 'A'] },
      { name: 'Revenue', type: FieldType.number, config: { unit: 'currencyUSD' }, values: [10, 30, 90, 100, 100] },
      { name: 'Quantity', type: FieldType.number, values: [1, 3, 9, 10, 10] },
    ],
  });
}
const options = (overrides: Partial<PivotOptions> = {}): PivotOptions => ({
  frameIndex: 0,
  rows: [{ name: 'Region' }],
  columns: [{ name: 'Period' }],
  values: [{ field: { name: 'Revenue' }, reducer: 'mean', footerReducers: ['mean', 'distinctCount'] }],
  totalRow: true,
  totalColumns: true,
  ...overrides,
});

it('aggregates duplicate intersections and calculates source-weighted totals for remaining groups', () => {
  const result = pivotFrame(source(), options());
  expect(result.fields.map((field) => field.name)).toEqual([
    'Region',
    'Jan · Revenue · Mean',
    'Feb · Revenue · Mean',
    'Grand total · Revenue · Mean',
  ]);
  expect(result.fields.map((field) => field.values)).toEqual([
    ['East', 'West'],
    [20, 100],
    [90, null],
    [130 / 3, 100],
  ]);
  const metadata = getPivotProvenance(result)!;
  expect(pivotFooter(metadata, result.fields[1], [0, 1], ['mean', 'distinctCount'])).toMatchObject({
    mean: 60,
    distinctCount: 3,
  });
  expect(pivotFooter(metadata, result.fields[3], [0, 1], ['mean', 'distinctCount'])).toMatchObject({
    mean: 66,
    distinctCount: 4,
  });
  expect(pivotFooter(metadata, result.fields[3], [0], ['mean', 'distinctCount'])).toMatchObject({
    mean: 130 / 3,
    distinctCount: 3,
  });
});

it('supports multiple dimensions and measures with the same field using different calculations', () => {
  const result = pivotFrame(
    source(),
    options({
      rows: [{ name: 'Region' }, { name: 'Product' }],
      columns: [],
      totalColumns: false,
      values: [
        { field: { name: 'Revenue' }, reducer: 'sum', footerReducers: ['mean'] },
        { field: { name: 'Revenue' }, reducer: 'count', footerReducers: ['count'] },
        { field: { name: 'Quantity' }, reducer: 'max', footerReducers: ['max'] },
      ],
    })
  );
  expect(result.fields.map((field) => field.values)).toEqual([
    ['East', 'East', 'West'],
    ['A', 'B', 'A'],
    [40, 90, 200],
    [2, 1, 2],
    [3, 9, 10],
  ]);
  expect(result.fields[2].config.unit).toBe('currencyUSD');
  expect(result.fields[3].config.unit).toBeUndefined();
});

it('supports multiple column dimensions in first-seen order', () => {
  const result = pivotFrame(
    source(),
    options({ columns: [{ name: 'Period' }, { name: 'Product' }], totalColumns: false })
  );
  expect(result.fields.map((field) => field.name)).toEqual([
    'Region',
    'Jan · A · Revenue · Mean',
    'Feb · B · Revenue · Mean',
  ]);
});

it('separates typed keys and delimiter-containing values and does not mutate cached source calculations', () => {
  const frame = source();
  frame.fields[0].values = [1, '1', null, undefined, '__proto__'];
  frame.fields[1].values = ['a,b', 'a,b', 'a,b', 'a,b', 'a,b'];
  frame.fields[3].state = { calcs: { sum: 999 } };
  const result = pivotFrame(frame, options({ totalColumns: false }));
  expect(result.fields[0].values).toEqual([1, '1', null, undefined, '__proto__']);
  expect(result.fields[1].values).toEqual([10, 30, 90, 100, 100]);
  expect(frame.fields[3].state.calcs).toEqual({ sum: 999 });
});

it('preserves null reducer semantics and outputs empty grouped summaries', () => {
  const frame = source();
  frame.fields[3].values = [null, null, null, null, null];
  expect(pivotFrame(frame, options()).fields[1].values).toEqual([null, null]);
  frame.length = 0;
  frame.fields.forEach((field) => (field.values = []));
  const result = pivotFrame(frame, options({ columns: [] }));
  expect(result.fields.map((field) => field.values)).toEqual([[], []]);
  expect(pivotFooter(getPivotProvenance(result)!, result.fields[1], [], ['count'])).toMatchObject({ count: 0 });
});

it.each([
  { rows: [] },
  { rows: [{ name: 'missing' }] },
  { columns: [{ name: 'Region' }] },
  { values: [options().values[0], options().values[0]] },
  { values: [{ field: { name: 'Region' }, reducer: 'mean', footerReducers: [] }] },
])('rejects invalid configuration %j', (invalid) => {
  expect(() => pivotFrame(source(), options(invalid))).toThrow();
});

it('rejects ambiguous identities but resolves labels', () => {
  const frame = source();
  frame.fields.push({ ...frame.fields[0] });
  expect(() => pivotFrame(frame, options())).toThrow('ambiguous');
  frame.fields[5].labels = { source: 'second' };
  expect(pivotFrame(frame, options()).length).toBe(2);
});

it('rejects expansion before allocating a dense matrix', () => {
  const frame = source();
  frame.length = 1001;
  frame.fields.forEach((field) => (field.values = Array.from({ length: 1001 }, (_, index) => index)));
  expect(() => pivotFrame(frame, options())).toThrow('too large');
});

it('only transforms the selected frame, including duplicate or missing refIds', async () => {
  const first = source();
  const second = source();
  const result = await lastValueFrom(
    pivotTransformer.operator(options({ frameIndex: 1 }), { interpolate: (value) => value })(of([first, second]))
  );
  expect(result[0]).toBe(first);
  expect(result[1].fields[1].values).toEqual([20, 100]);
});

it('bounds dense output size even with fewer than 1000 generated columns', () => {
  const frame = source();
  frame.length = 2001;
  frame.fields.forEach((field) => (field.values = Array.from({ length: frame.length }, (_, i) => i)));
  frame.fields[1].values = Array.from({ length: frame.length }, (_, i) => i % 500);
  expect(() => pivotFrame(frame, options())).toThrow('too large');
});

it('keeps distinct generated fields when formatted dimension labels collide', () => {
  const frame = source();
  frame.fields[1].values = [1, '1', null, '(blank)', null];
  const result = pivotFrame(frame, options({ totalColumns: false }));
  expect(result.fields.map((field) => field.name)).toEqual([
    'Region',
    '1 · Revenue · Mean',
    '1 · Revenue · Mean (2)',
    '(blank) · Revenue · Mean',
    '(blank) · Revenue · Mean (2)',
  ]);
  expect(result.fields[3].values).toEqual([90, 100]);
  expect(result.fields[4].values).toEqual([null, 100]);
});

it('reports an invalid refreshed schema without throwing from the observable', async () => {
  const frame = source();
  frame.fields[0].name = 'Renamed';
  const [result] = await lastValueFrom(
    pivotTransformer.operator(options(), { interpolate: (value) => value })(of([frame]))
  );
  expect(getPivotProvenance(result)?.error).toContain('missing, ambiguous, or unsupported');
  expect(getPivotProvenance(result)?.source).toBe(frame);
  expect(frame.meta).toBeUndefined();
});
