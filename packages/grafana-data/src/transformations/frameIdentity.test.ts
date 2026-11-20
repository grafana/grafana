import { toDataFrame } from '../dataframe/processDataFrame';
import { FieldType } from '../types/dataFrame';

import {
  createFieldReferenceResolver,
  type FieldReference,
  getFieldReferenceKey,
  getFieldReferences,
  getRowIdentity,
  isFieldReference,
} from './frameIdentity';

it('identifies parent rows by their values without including nested frames', () => {
  const frame = toDataFrame({
    fields: [
      { name: 'Parent', type: FieldType.string, values: ['one', 'two'] },
      { name: 'Children', type: FieldType.nestedFrames, values: [[], []] },
    ],
  });
  expect(getRowIdentity(frame, 0)).toBe('["one"]');
  expect(getRowIdentity(frame, 1)).toBe('["two"]');
  frame.fields[1].values[0] = [toDataFrame({ fields: [{ name: 'Value', values: [10] }] })];
  expect(getRowIdentity(frame, 0)).toBe('["one"]');
  frame.fields[0].values[0] = 'new';
  expect(getRowIdentity(frame, 0)).toBe('["new"]');
});

describe('field references', () => {
  const frame = toDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: [1] },
      { name: 'Value', type: FieldType.number, values: [1], labels: { host: 'a', dc: 'x' } },
      { name: 'Value', type: FieldType.number, values: [2], labels: { dc: 'x', host: 'a' } },
      { name: 'Value', type: FieldType.number, values: [3], labels: { host: 'b' } },
      { name: 'value', type: FieldType.number, values: [4], labels: {} },
      { name: 'value', type: FieldType.number, values: [5] },
      { name: 'value', type: FieldType.number, values: [6] },
    ],
  });

  it('identifies fields by name and labels and counts repeats of both', () => {
    expect(getFieldReferences(frame)).toEqual([
      { name: 'time' },
      { name: 'Value', labels: { host: 'a', dc: 'x' } },
      { name: 'Value', labels: { dc: 'x', host: 'a' }, occurrence: 1 },
      { name: 'Value', labels: { host: 'b' } },
      { name: 'value' },
      { name: 'value', occurrence: 1 },
      { name: 'value', occurrence: 2 },
    ]);
  });

  it('finds every field from its own reference', () => {
    const resolve = createFieldReferenceResolver(frame);
    getFieldReferences(frame).forEach((reference, index) => {
      expect(resolve(reference)).toBe(index);
    });
  });

  it('ignores display names, which overrides and renames change', () => {
    const renamed = {
      ...frame,
      fields: frame.fields.map((field) => ({ ...field, config: { displayName: 'Renamed' } })),
    };
    expect(createFieldReferenceResolver(renamed)({ name: 'Value', labels: { host: 'b' } })).toBe(3);
  });

  it.each<{ name: string; reference: FieldReference }>([
    { name: 'a missing name', reference: { name: 'host' } },
    { name: 'different labels', reference: { name: 'Value', labels: { host: 'c' } } },
    { name: 'labels where the field has none', reference: { name: 'time', labels: { host: 'a' } } },
    { name: 'an occurrence past the last repeat', reference: { name: 'value', occurrence: 3 } },
  ])('finds nothing for $name', ({ reference }) => {
    expect(createFieldReferenceResolver(frame)(reference)).toBe(-1);
  });

  it('treats empty labels as no labels', () => {
    const resolve = createFieldReferenceResolver(frame);
    expect(resolve({ name: 'time', labels: {} })).toBe(0);
    expect(resolve({ name: 'value', labels: {}, occurrence: 1 })).toBe(5);
    expect(getFieldReferenceKey({ name: 'value', labels: {} })).toBe(getFieldReferenceKey({ name: 'value' }));
  });

  it('builds the same key for the same identity and another for a different occurrence', () => {
    expect(getFieldReferenceKey({ name: 'Value', labels: { host: 'a', dc: 'x' } })).toBe(
      getFieldReferenceKey({ name: 'Value', labels: { dc: 'x', host: 'a' }, occurrence: 0 })
    );
    expect(getFieldReferenceKey({ name: 'value', occurrence: 1 })).not.toBe(getFieldReferenceKey({ name: 'value' }));
  });

  it.each([
    { name: 'a name', reference: { name: 'host' }, valid: true },
    { name: 'labels and an occurrence', reference: { name: 'Value', labels: { a: 'b' }, occurrence: 2 }, valid: true },
    { name: 'null', reference: null, valid: false },
    { name: 'a string', reference: 'host', valid: false },
    { name: 'no name', reference: { labels: { a: 'b' } }, valid: false },
    { name: 'a numeric name', reference: { name: 3 }, valid: false },
    { name: 'labels that are not strings', reference: { name: 'host', labels: { a: 1 } }, valid: false },
    { name: 'labels in an array', reference: { name: 'host', labels: ['a'] }, valid: false },
    { name: 'a negative occurrence', reference: { name: 'host', occurrence: -1 }, valid: false },
    { name: 'a fractional occurrence', reference: { name: 'host', occurrence: 0.5 }, valid: false },
    { name: 'a string occurrence', reference: { name: 'host', occurrence: '1' }, valid: false },
  ])('accepts $name as a reference: $valid', ({ reference, valid }) => {
    expect(isFieldReference(reference)).toBe(valid);
    if (!valid) {
      expect(createFieldReferenceResolver(frame)(reference)).toBe(-1);
    }
  });
});
