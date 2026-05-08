import { FieldMatcherID, type FieldConfigSource } from '@grafana/data';

import { applyColumnWidthOverride } from './columnResizeFieldConfig';

describe('applyColumnWidthOverride', () => {
  const base: FieldConfigSource = {
    defaults: {},
    overrides: [],
  };

  it('adds a new override when none match', () => {
    const next = applyColumnWidthOverride(base, 'Time', 120);
    expect(next.overrides).toHaveLength(1);
    expect(next.overrides![0]).toEqual({
      matcher: {
        id: FieldMatcherID.byName,
        options: 'Time',
        scope: 'series',
      },
      properties: [{ id: 'custom.width', value: 120 }],
    });
  });

  it('updates width on an existing override that omits matcher.scope (defaults to series)', () => {
    const existing: FieldConfigSource = {
      defaults: {},
      overrides: [
        {
          matcher: {
            id: FieldMatcherID.byName,
            options: 'Time',
          },
          properties: [{ id: 'custom.width', value: 80 }],
        },
      ],
    };

    const next = applyColumnWidthOverride(existing, 'Time', 200);

    expect(next.overrides).toHaveLength(1);
    expect(next.overrides![0].properties).toEqual([{ id: 'custom.width', value: 200 }]);
  });

  it('does not append a duplicate override when scope is undefined on disk but resize uses series', () => {
    const existing: FieldConfigSource = {
      defaults: {},
      overrides: [
        {
          matcher: {
            id: FieldMatcherID.byName,
            options: 'Line',
          },
          properties: [{ id: 'custom.width', value: 100 }],
        },
      ],
    };

    const next = applyColumnWidthOverride(existing, 'Line', 150);

    expect(next.overrides).toHaveLength(1);
    expect(next.overrides![0].properties).toEqual([{ id: 'custom.width', value: 150 }]);
  });

  it('appends custom.width to an existing rule that has other properties', () => {
    const existing: FieldConfigSource = {
      defaults: {},
      overrides: [
        {
          matcher: {
            id: FieldMatcherID.byName,
            options: 'Time',
            scope: 'series',
          },
          properties: [{ id: 'custom.align', value: 'center' }],
        },
      ],
    };

    const next = applyColumnWidthOverride(existing, 'Time', 99);

    expect(next.overrides).toHaveLength(1);
    expect(next.overrides![0].properties).toEqual([
      { id: 'custom.align', value: 'center' },
      { id: 'custom.width', value: 99 },
    ]);
  });
});
