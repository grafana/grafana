import { act, renderHook } from '@testing-library/react';

import { useLimit } from './hooks';

describe('useLimit', () => {
  it('should return the correct limit', () => {
    const { result } = renderHook(() => useLimit(10));
    expect(result.current[0]).toBe(10);
  });

  it('should update the limit when the provided limit changes', () => {
    const { result } = renderHook(() => useLimit(10));
    act(() => {
      result.current[1](20);
    });
    expect(result.current[0]).toBe(20);
  });

  it('should expose a setter function that can be used to update the limit', () => {
    const { result } = renderHook(() => useLimit(10));
    act(() => {
      const setLimit = result.current[1];
      setLimit((v) => v + 20);
    });
    expect(result.current[0]).toBe(30);
  });

  it('should not update the limit when the provided limit is the same', () => {
    const { result, rerender } = renderHook(({ providedLimit }) => useLimit(providedLimit), {
      initialProps: { providedLimit: 10 },
    });
    act(() => {
      const setLimit = result.current[1];
      setLimit(20);
    });
    expect(result.current[0]).toBe(20);
    rerender({ providedLimit: 10 });
    expect(result.current[0]).toBe(20);
  });

  it('should update the limit when the provided limit is the not the same and the current limit is the same', () => {
    const { result, rerender } = renderHook(({ providedLimit }) => useLimit(providedLimit), {
      initialProps: { providedLimit: 10 },
    });
    act(() => {
      const setLimit = result.current[1];
      setLimit(20);
    });
    expect(result.current[0]).toBe(20);
    rerender({ providedLimit: 30 });
    expect(result.current[0]).toBe(30);
  });
});
