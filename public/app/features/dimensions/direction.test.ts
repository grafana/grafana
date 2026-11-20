import { type DataFrame, toDataFrame } from '@grafana/data';
import { ConnectionDirection, type DirectionDimensionConfig, DirectionDimensionMode } from '@grafana/schema';

import { getDirectionDimension } from './direction';

function makeFrame(values: unknown[], name = 'dir'): DataFrame {
  return toDataFrame({
    fields: [{ name, values }],
  });
}

describe('direction dimension', () => {
  describe('fixed mode', () => {
    it('returns the configured fixed direction and is not assumed', () => {
      const dim = getDirectionDimension(undefined, {
        mode: DirectionDimensionMode.Fixed,
        fixed: ConnectionDirection.Reverse,
        field: '',
      });
      expect(dim.value()).toBe(ConnectionDirection.Reverse);
      expect(dim.get(0)).toBe(ConnectionDirection.Reverse);
      expect(dim.isAssumed).toBe(false);
    });

    it('defaults to Forward and is assumed when no fixed value is configured', () => {
      const dim = getDirectionDimension(undefined, {
        mode: DirectionDimensionMode.Fixed,
      } as DirectionDimensionConfig);
      expect(dim.value()).toBe(ConnectionDirection.Forward);
      expect(dim.isAssumed).toBe(true);
    });

    it('falls back to fixed (assumed) when field mode references a missing field', () => {
      const dim = getDirectionDimension(makeFrame([1, 2, 3]), {
        mode: DirectionDimensionMode.Field,
        field: 'does-not-exist',
        fixed: ConnectionDirection.Reverse,
      });
      // no matching field -> fixed branch, but flagged assumed because a field name was set
      expect(dim.value()).toBe(ConnectionDirection.Reverse);
      expect(dim.isAssumed).toBe(true);
      expect(dim.field).toBeUndefined();
    });
  });

  describe('field mode', () => {
    it.each([
      { value: 5, expected: ConnectionDirection.Forward, $desc: 'positive -> Forward' },
      { value: -5, expected: ConnectionDirection.Reverse, $desc: 'negative -> Reverse' },
      { value: 0, expected: ConnectionDirection.None, $desc: 'zero -> None' },
      { value: null, expected: ConnectionDirection.Forward, $desc: 'null -> Forward' },
      { value: 'nope', expected: ConnectionDirection.Forward, $desc: 'NaN -> Forward' },
    ])('maps value at index by sign: $desc', ({ value, expected }) => {
      const dim = getDirectionDimension(makeFrame([value]), {
        mode: DirectionDimensionMode.Field,
        field: 'dir',
        fixed: ConnectionDirection.Forward,
      });
      expect(dim.get(0)).toBe(expected);
      expect(dim.field?.name).toBe('dir');
    });

    it('resolves a per-index direction and value() reads the last non-null value', () => {
      const dim = getDirectionDimension(makeFrame([-2, 0, 7, null]), {
        mode: DirectionDimensionMode.Field,
        field: 'dir',
        fixed: ConnectionDirection.Forward,
      });
      expect([dim.get(0), dim.get(1), dim.get(2)]).toEqual([
        ConnectionDirection.Reverse,
        ConnectionDirection.None,
        ConnectionDirection.Forward,
      ]);
      // last non-null is 7 -> Forward
      expect(dim.value()).toBe(ConnectionDirection.Forward);
    });
  });
});
