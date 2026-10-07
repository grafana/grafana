import { toDataFrame } from '@grafana/data';

import { filterTransformations, editableTableFilter } from './registry';

const source = toDataFrame({ fields: [{ name: 'time', values: [1000, 2000] }] });
const context = { source, field: source.fields[0], frameKey: 'A', frameIndex: 0 };
const { rangeFilter, valueFilter } = filterTransformations;

it.each([
  { min: undefined, max: 2000, includeMissing: true },
  { min: 1000, max: undefined, includeMissing: false },
])('retains open bounds and missing-value choice: %j', (selection) => {
  const predicate = rangeFilter.createPredicate(selection);
  expect(predicate).toEqual({
    id: 'between',
    options: {
      from: selection.min,
      to: selection.max,
      inclusive: true,
      allowOpenBounds: true,
      includeMissing: selection.includeMissing,
    },
  });
  const configs = rangeFilter.write([], predicate, context);
  expect(rangeFilter.read(configs, context)[0].options.filters[0].config).toEqual(predicate);
  expect(editableTableFilter(rangeFilter.read(configs, context)[0])).toBe(true);
});

it('switches an editable value selection to a range without duplicating the filter or changing its target', () => {
  const selected = valueFilter.write([], valueFilter.createPredicate(context.field, ['1000']), context);
  const ranged = rangeFilter.write(
    selected,
    rangeFilter.createPredicate({ min: 1000, max: 2000, includeMissing: false }),
    context
  );
  expect(ranged).toHaveLength(1);
  expect(ranged[0].options.target).toEqual({
    frameKey: 'A',
    frameIndex: 0,
    refId: undefined,
    parentIndex: undefined,
    parentKey: undefined,
  });
  expect(ranged[0].options.filters[0]).toEqual({
    fieldName: 'time',
    field: { name: 'time', labels: undefined },
    config: {
      id: 'between',
      options: { from: 1000, to: 2000, inclusive: true, allowOpenBounds: true, includeMissing: false },
    },
  });
});

it.each([{ inclusive: false }, { allowOpenBounds: false }, { includeMissing: undefined }, { from: Infinity }])(
  'does not expose incompatible ranges as editable: %j',
  (options) => {
    const predicate = rangeFilter.createPredicate({ min: 1000, max: 2000, includeMissing: false });
    const configs = rangeFilter.write([], { ...predicate, options: { ...predicate.options, ...options } }, context);
    expect(editableTableFilter(rangeFilter.read(configs, context)[0])).toBe(false);
  }
);

it('uses the panel timezone for new selections and preserves a saved timezone', () => {
  expect(valueFilter.createPredicate(context.field, ['1000'], undefined, 'Europe/Berlin').options.timeZone).toBe(
    'Europe/Berlin'
  );
  expect(
    valueFilter.createPredicate(
      context.field,
      ['2000'],
      { values: ['1000'], mode: 'display', timeZone: 'UTC' },
      'Europe/Berlin'
    ).options.timeZone
  ).toBe('UTC');
});
