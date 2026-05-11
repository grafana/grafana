import { type FieldConfigSource, FieldMatcherID } from '@grafana/data';

import { onColumnResize } from './TablePanel';

const setup = (overrides: FieldConfigSource['overrides']) => {
  const fieldConfig: FieldConfigSource = { defaults: {}, overrides };
  const onFieldConfigChange = jest.fn();
  return {
    fieldConfig,
    onFieldConfigChange,
    props: { fieldConfig, onFieldConfigChange },
    nextConfig: () => onFieldConfigChange.mock.calls[0][0] as FieldConfigSource,
  };
};

describe('onColumnResize', () => {
  it('appends a new override when no overrides exist', () => {
    const { props, onFieldConfigChange, nextConfig } = setup([]);

    onColumnResize('Value', 150, 'series', props);

    expect(onFieldConfigChange).toHaveBeenCalledTimes(1);
    expect(nextConfig().overrides).toEqual([
      {
        matcher: { id: FieldMatcherID.byName, options: 'Value', scope: 'series' },
        properties: [{ id: 'custom.width', value: 150 }],
      },
    ]);
  });

  it('appends a new override when no existing override matches the field name', () => {
    const { props, nextConfig } = setup([
      {
        matcher: { id: FieldMatcherID.byName, options: 'Other', scope: 'series' },
        properties: [{ id: 'custom.width', value: 100 }],
      },
    ]);

    onColumnResize('Value', 150, 'series', props);

    const next = nextConfig();
    expect(next.overrides).toHaveLength(2);
    expect(next.overrides[1]).toEqual({
      matcher: { id: FieldMatcherID.byName, options: 'Value', scope: 'series' },
      properties: [{ id: 'custom.width', value: 150 }],
    });
  });

  it('updates the width property on an existing matching override', () => {
    const { props, nextConfig } = setup([
      {
        matcher: { id: FieldMatcherID.byName, options: 'Value', scope: 'series' },
        properties: [{ id: 'custom.width', value: 100 }],
      },
    ]);

    onColumnResize('Value', 250, 'series', props);

    expect(nextConfig().overrides).toEqual([
      {
        matcher: { id: FieldMatcherID.byName, options: 'Value', scope: 'series' },
        properties: [{ id: 'custom.width', value: 250 }],
      },
    ]);
  });

  it('adds a width property to a matching override that has other properties but no width', () => {
    const { props, nextConfig } = setup([
      {
        matcher: { id: FieldMatcherID.byName, options: 'Value', scope: 'series' },
        properties: [{ id: 'custom.align', value: 'right' }],
      },
    ]);

    onColumnResize('Value', 250, 'series', props);

    expect(nextConfig().overrides[0].properties).toEqual([
      { id: 'custom.align', value: 'right' },
      { id: 'custom.width', value: 250 },
    ]);
  });

  it('matches a scopeless override when the target scope is "series"', () => {
    const { props, nextConfig } = setup([
      {
        matcher: { id: FieldMatcherID.byName, options: 'Value' },
        properties: [{ id: 'custom.width', value: 100 }],
      },
    ]);

    onColumnResize('Value', 200, 'series', props);

    const next = nextConfig();
    expect(next.overrides).toHaveLength(1);
    expect(next.overrides[0].matcher).toEqual({ id: FieldMatcherID.byName, options: 'Value' });
    expect(next.overrides[0].properties).toEqual([{ id: 'custom.width', value: 200 }]);
  });

  it('treats an omitted fieldScope as "series" and matches a scopeless override', () => {
    const { props, nextConfig } = setup([
      {
        matcher: { id: FieldMatcherID.byName, options: 'Value' },
        properties: [{ id: 'custom.width', value: 100 }],
      },
    ]);

    onColumnResize('Value', 200, undefined, props);

    expect(nextConfig().overrides[0].properties).toEqual([{ id: 'custom.width', value: 200 }]);
  });

  it('does not match a scopeless override when the target scope is "nested"', () => {
    const { props, nextConfig } = setup([
      {
        matcher: { id: FieldMatcherID.byName, options: 'Value' },
        properties: [{ id: 'custom.width', value: 100 }],
      },
    ]);

    onColumnResize('Value', 200, 'nested', props);

    const next = nextConfig();
    expect(next.overrides).toHaveLength(2);
    expect(next.overrides[0].properties).toEqual([{ id: 'custom.width', value: 100 }]);
    expect(next.overrides[1]).toEqual({
      matcher: { id: FieldMatcherID.byName, options: 'Value', scope: 'nested' },
      properties: [{ id: 'custom.width', value: 200 }],
    });
  });

  it('updates the matching nested override without affecting a series override for the same field', () => {
    const { props, nextConfig } = setup([
      {
        matcher: { id: FieldMatcherID.byName, options: 'Value', scope: 'series' },
        properties: [{ id: 'custom.width', value: 100 }],
      },
      {
        matcher: { id: FieldMatcherID.byName, options: 'Value', scope: 'nested' },
        properties: [{ id: 'custom.width', value: 120 }],
      },
    ]);

    onColumnResize('Value', 300, 'nested', props);

    const next = nextConfig();
    expect(next.overrides).toHaveLength(2);
    expect(next.overrides[0].properties).toEqual([{ id: 'custom.width', value: 100 }]);
    expect(next.overrides[1].properties).toEqual([{ id: 'custom.width', value: 300 }]);
  });

  it('does not match a "nested" override when the target scope is "series"', () => {
    const { props, nextConfig } = setup([
      {
        matcher: { id: FieldMatcherID.byName, options: 'Value', scope: 'nested' },
        properties: [{ id: 'custom.width', value: 100 }],
      },
    ]);

    onColumnResize('Value', 200, 'series', props);

    const next = nextConfig();
    expect(next.overrides).toHaveLength(2);
    expect(next.overrides[0].matcher.scope).toBe('nested');
    expect(next.overrides[1]).toEqual({
      matcher: { id: FieldMatcherID.byName, options: 'Value', scope: 'series' },
      properties: [{ id: 'custom.width', value: 200 }],
    });
  });

  it('preserves unrelated overrides', () => {
    const { props, nextConfig } = setup([
      {
        matcher: { id: FieldMatcherID.byName, options: 'Other', scope: 'series' },
        properties: [
          { id: 'custom.width', value: 50 },
          { id: 'custom.align', value: 'left' },
        ],
      },
      {
        matcher: { id: FieldMatcherID.byName, options: 'Value', scope: 'series' },
        properties: [{ id: 'custom.width', value: 100 }],
      },
    ]);

    onColumnResize('Value', 250, 'series', props);

    const next = nextConfig();
    expect(next.overrides).toHaveLength(2);
    expect(next.overrides[0]).toEqual({
      matcher: { id: FieldMatcherID.byName, options: 'Other', scope: 'series' },
      properties: [
        { id: 'custom.width', value: 50 },
        { id: 'custom.align', value: 'left' },
      ],
    });
    expect(next.overrides[1].properties).toEqual([{ id: 'custom.width', value: 250 }]);
  });
});
