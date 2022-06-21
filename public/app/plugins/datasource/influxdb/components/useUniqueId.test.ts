import { renderHook } from '@testing-library/react-hooks';

import { useUniqueId } from './useUniqueId';

describe('useUniqueId', () => {
  it('should work correctly', () => {
    const { result: resultA, rerender: rerenderA } = renderHook(() => useUniqueId());
    const { result: resultB, rerender: rerenderB } = renderHook(() => useUniqueId());

    // the values of the separate hooks should be different
    expect(resultA.current).not.toBe(resultB.current);

    // we copy the current values after the first render
    const firstValueA = resultA.current;
    const firstValueB = resultB.current;

    rerenderA();
    rerenderB();

    // we check that the value did not change
    expect(resultA.current).toBe(firstValueA);
    expect(resultB.current).toBe(firstValueB);
  });
});
