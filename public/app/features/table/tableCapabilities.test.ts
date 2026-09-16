import { FieldType, toDataFrame } from '@grafana/data';

import { supportsColumnManagement, withRefreshedTableCapabilities } from './tableCapabilities';

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

    // Scenes relies on field value identity when a field leaves the render.
    expect(a.values).toBe(original.fields[0].values);
  });

  it('disables column management for nested tables', () => {
    const nested = toDataFrame({
      fields: [
        { name: 'parent', type: FieldType.string, values: ['a'] },
        { name: 'nested', type: FieldType.nestedFrames, values: [[]] },
      ],
    });

    expect(supportsColumnManagement(nested)).toBe(false);

    for (const field of withRefreshedTableCapabilities(nested).fields) {
      expect(field.config.custom).toMatchObject({ filterable: true, reorderable: false, hideable: false });
    }
  });
});
