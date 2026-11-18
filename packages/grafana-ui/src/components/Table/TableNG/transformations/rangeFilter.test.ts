import { toDataFrame } from '@grafana/data';

import { activeFilters, writeTableFilter } from './filterByValue';
import { createRangePredicate, editableRangeFilter } from './rangeFilter';
import { createValuePredicate, unsupportedFilterReason } from './valueFilter';

const source = toDataFrame({ fields: [{ name: 'time', values: [1000, 2000] }] });
const context = { source, field: source.fields[0], frameKey: 'A', frameIndex: 0 };
const readFilters = (configs: Parameters<typeof activeFilters>[0]) =>
  activeFilters(configs, context.frameKey, context.source);

it.each([
  { min: undefined, max: 2000, includeMissing: true },
  { min: 1000, max: undefined, includeMissing: false },
])('retains open bounds and missing-value choice: %j', (selection) => {
  const predicate = createRangePredicate(selection);
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
  const configs = writeTableFilter([], predicate, context);
  expect(readFilters(configs)[0].options.filters[0].config).toEqual(predicate);
  expect(editableRangeFilter(readFilters(configs)[0])).toBe(true);
  expect(unsupportedFilterReason(readFilters(configs))).toBeUndefined();
});

it('switches an editable value selection to a range without duplicating the filter or changing its target', () => {
  const selected = writeTableFilter([], createValuePredicate(context.field, ['1000']), context);
  const ranged = writeTableFilter(
    selected,
    createRangePredicate({ min: 1000, max: 2000, includeMissing: false }),
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
    const predicate = createRangePredicate({ min: 1000, max: 2000, includeMissing: false });
    const configs = writeTableFilter([], { ...predicate, options: { ...predicate.options, ...options } }, context);
    expect(editableRangeFilter(readFilters(configs)[0])).toBe(false);
    expect(unsupportedFilterReason(readFilters(configs))).toBe('uneditable');
  }
);
