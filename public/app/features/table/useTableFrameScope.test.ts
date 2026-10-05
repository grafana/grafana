import { renderHook } from '@testing-library/react';

import { type DataFrame, FieldType, toDataFrame } from '@grafana/data';

import { useTableFrameScope } from './hooks';

function frame(refId?: string, name = 'Value', values = [1]): DataFrame {
  return toDataFrame({ refId, fields: [{ name, type: FieldType.number, values }] });
}

describe('useTableFrameScope', () => {
  it('preserves scope when only source values refresh', () => {
    const { result, rerender } = renderHook(useTableFrameScope, { initialProps: [frame('A')] });
    expect(result.current(0)).toBe('["A",0,1]');
    rerender([frame('A', 'Value', [2, 3])]);
    expect(result.current(0)).toBe('["A",0,1]');
  });

  it('invalidates scope when source fields change', () => {
    const { result, rerender } = renderHook(useTableFrameScope, { initialProps: [frame('A')] });
    rerender([frame('A', 'Renamed')]);
    expect(result.current(0)).toBe('["A",0,2]');
  });

  it('distinguishes same-schema queries without relying on a revision change', () => {
    const { result, rerender } = renderHook(useTableFrameScope, { initialProps: [frame('A')] });
    rerender([frame('B')]);
    expect(result.current(0)).toBe('["B",0,1]');
  });

  it('distinguishes duplicate and missing query identifiers by position', () => {
    const { result } = renderHook(useTableFrameScope, {
      initialProps: [frame('A'), frame('A'), frame(), frame()],
    });
    expect([0, 1, 2, 3].map(result.current)).toEqual(['["A",0,1]', '["A",1,1]', '[null,2,1]', '[null,3,1]']);
  });
});
