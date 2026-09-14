import { FieldType, toDataFrame } from '@grafana/data';

import { withRefreshedTableCapabilities } from './tableCapabilities';

const frame = () =>
  toDataFrame({
    fields: [
      { name: 'A', type: FieldType.string, values: ['a'], config: { custom: { width: 120 } } },
      { name: 'B', type: FieldType.number, values: [1], config: { custom: { filterable: false } } },
    ],
  });

describe('withRefreshedTableCapabilities', () => {
  it('opts every column into filtering, reordering and hiding', () => {
    const withCapabilities = withRefreshedTableCapabilities(frame());

    for (const field of withCapabilities.fields) {
      expect(field.config.custom).toMatchObject({ filterable: true, reorderable: true, hideable: true });
    }
  });

  it('overrides a capability the field config turned off', () => {
    // The field options for these are gone in this mode, so a saved `false` would otherwise leave a
    // column that cannot be filtered and nothing in the UI able to change it.
    const [, b] = withRefreshedTableCapabilities(frame()).fields;

    expect(b.config.custom?.filterable).toBe(true);
  });

  it('leaves the rest of the field config alone', () => {
    const [a] = withRefreshedTableCapabilities(frame()).fields;

    expect(a.config.custom?.width).toBe(120);
  });

  it('does not touch the frame it was given', () => {
    const original = frame();

    withRefreshedTableCapabilities(original);

    expect(original.fields[1].config.custom).toEqual({ filterable: false });
  });

  it('passes the values array through by reference', () => {
    const original = frame();
    const [a] = withRefreshedTableCapabilities(original).fields;

    // Scenes truncates the values array of a field that leaves the render by identity, so a copy
    // here would quietly opt the panel out of that.
    expect(a.values).toBe(original.fields[0].values);
  });
});
