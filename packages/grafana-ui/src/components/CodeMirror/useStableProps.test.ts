import { renderHook } from '@testing-library/react';

import { useShallowStable, useStableCallback } from './useStableProps';

describe('useShallowStable', () => {
  it('keeps the first reference for a shallow-equal array', () => {
    const a = {};
    const b = {};
    const { result, rerender } = renderHook((props: unknown[]) => useShallowStable(props), {
      initialProps: [a, b],
    });
    const first = result.current;

    rerender([a, b]);

    expect(result.current).toBe(first);
  });

  it('returns the new reference when a member changes', () => {
    const { result, rerender } = renderHook((props: unknown[]) => useShallowStable(props), {
      initialProps: [{}],
    });
    const first = result.current;
    const next = [{}];

    rerender(next);

    expect(result.current).toBe(next);
    expect(result.current).not.toBe(first);
  });

  it('returns the new reference when the length changes', () => {
    const a = {};
    const { result, rerender } = renderHook((props: unknown[]) => useShallowStable(props), {
      initialProps: [a],
    });
    const first = result.current;

    rerender([a, {}]);

    expect(result.current).not.toBe(first);
  });

  it('keeps the first reference for a shallow-equal object', () => {
    const { result, rerender } = renderHook((props: { lineNumbers: boolean }) => useShallowStable(props), {
      initialProps: { lineNumbers: true },
    });
    const first = result.current;

    rerender({ lineNumbers: true });
    expect(result.current).toBe(first);

    rerender({ lineNumbers: false });
    expect(result.current).toEqual({ lineNumbers: false });
  });

  it('does not treat an array as equal to an object with matching indices', () => {
    const { result, rerender } = renderHook((props: unknown) => useShallowStable(props), {
      initialProps: ['a'] as unknown,
    });

    rerender({ 0: 'a' });

    expect(Array.isArray(result.current)).toBe(false);
  });

  it('passes primitives and nullish values through', () => {
    const { result, rerender } = renderHook((props: unknown) => useShallowStable(props), {
      initialProps: false as unknown,
    });

    expect(result.current).toBe(false);

    rerender(undefined);
    expect(result.current).toBeUndefined();

    rerender(null);
    expect(result.current).toBeNull();
  });
});

describe('useStableCallback', () => {
  it('keeps the same reference across renders', () => {
    const { result, rerender } = renderHook((cb: () => void) => useStableCallback(cb), {
      initialProps: () => {},
    });
    const first = result.current;

    rerender(() => {});

    expect(result.current).toBe(first);
  });

  it('invokes the latest callback and returns its value', () => {
    const first = jest.fn().mockReturnValue('first');
    const second = jest.fn().mockReturnValue('second');
    const { result, rerender } = renderHook((cb: (value: string) => string) => useStableCallback(cb), {
      initialProps: first,
    });

    expect(result.current('a')).toBe('first');
    expect(first).toHaveBeenCalledWith('a');

    rerender(second);

    expect(result.current('b')).toBe('second');
    expect(second).toHaveBeenCalledWith('b');
    expect(first).toHaveBeenCalledTimes(1);
  });
});
