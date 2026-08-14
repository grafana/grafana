import { type ActionModel, type Field, type FieldConfigSource, FieldMatcherID, FieldType } from '@grafana/data';
import { getActions } from 'app/features/actions/utils';

import { getCellActions, getCurrentFrameIndex, onColumnResize, onSortByChange } from './utils';

jest.mock('app/features/actions/utils', () => ({
  getActions: jest.fn(),
}));

const getActionsMock = jest.mocked(getActions);

describe('getCurrentFrameIndex', () => {
  const frames = [{}, {}, {}] as never[];

  it('returns 0 when frameIndex is 0', () => {
    expect(getCurrentFrameIndex(frames, { frameIndex: 0 })).toBe(0);
  });

  it('returns the frameIndex when it is within range', () => {
    expect(getCurrentFrameIndex(frames, { frameIndex: 2 })).toBe(2);
  });

  it('returns 0 when frameIndex is negative', () => {
    expect(getCurrentFrameIndex(frames, { frameIndex: -1 })).toBe(0);
  });

  it('returns 0 when frameIndex is out of range', () => {
    expect(getCurrentFrameIndex(frames, { frameIndex: 5 })).toBe(0);
  });
});

describe('onColumnResize', () => {
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

describe('onSortByChange', () => {
  it('merges the new sortBy onto the existing options and forwards them', () => {
    const onOptionsChange = jest.fn();
    const options = { showHeader: true, sortBy: [{ displayName: 'old' }] };

    onSortByChange([{ displayName: 'time', desc: true }], { options, onOptionsChange });

    expect(onOptionsChange).toHaveBeenCalledTimes(1);
    expect(onOptionsChange).toHaveBeenCalledWith({
      showHeader: true,
      sortBy: [{ displayName: 'time', desc: true }],
    });
  });
});

describe('getCellActions', () => {
  const frame = { fields: [], length: 0 } as never;

  const makeField = (actions?: unknown[]): Field =>
    ({
      name: 'value',
      type: FieldType.string,
      values: [],
      config: { actions },
      state: { scopedVars: {} },
    }) as unknown as Field;

  const action = (title: string): ActionModel<Field> => ({ title }) as unknown as ActionModel<Field>;

  beforeEach(() => {
    getActionsMock.mockReset();
  });

  it('returns an empty array and skips resolution when the field has no configured actions', () => {
    const result = getCellActions(frame, makeField(), 0, undefined);

    expect(result).toEqual([]);
    expect(getActionsMock).not.toHaveBeenCalled();
  });

  it('returns the single resolved action as-is', () => {
    getActionsMock.mockReturnValue([action('open')]);

    const result = getCellActions(frame, makeField([{}]), 0, undefined);

    expect(result).toEqual([action('open')]);
    expect(getActionsMock).toHaveBeenCalledTimes(1);
  });

  it('de-duplicates resolved actions by title', () => {
    getActionsMock.mockReturnValue([action('open'), action('open'), action('close')]);

    const result = getCellActions(frame, makeField([{}, {}]), 0, undefined);

    expect(result).toEqual([action('open'), action('close')]);
  });
});
