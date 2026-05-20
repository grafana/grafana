import { renderHook, act } from '@testing-library/react';

import { usePlaceholder } from './usePlaceholder';

describe('usePlaceholder', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns a static value when a single value is supplied', () => {
    const { result } = renderHook(() => usePlaceholder(['Hello world']));
    const [, full, initial] = result.current;

    expect(full).toBe('Hello world');
    expect(initial).toBe('Hello world');

    // No timers should be pending
    expect(jest.getTimerCount()).toBe(0);
  });

  it('cycles through phases and advances to the next value', () => {
    const values = ['First prompt', 'Second prompt'];
    const { result } = renderHook(() => usePlaceholder(values));

    // Initially shows the first value in full
    expect(result.current[1]).toBe('First prompt');
    expect(result.current[2]).toBe('First prompt');

    // Each tick fires the current pending timer and flushes the resulting
    // React state update so the next timer is scheduled in the effect.
    // pause(4000) → 1 tick, delete 12 chars → 12 ticks, index advance → 1 tick,
    // type 13 chars → 13 ticks, total ≈ 27 ticks.
    for (let i = 0; i < 30; i++) {
      act(() => jest.runOnlyPendingTimers());
    }

    // After one full deletion+typing cycle, the second value should be active
    expect(result.current[1]).toBe('Second prompt');
  });

  it('shows cursor character during typing animation', () => {
    const mockInput = { placeholder: '' } as HTMLInputElement;
    const values = ['Hello', 'World'];
    renderHook(() => {
      const [ref] = usePlaceholder(values);
      // Assign the mock input to the ref so the effect can update its placeholder
      (ref as React.MutableRefObject<HTMLInputElement | null>).current = mockInput;
      return ref;
    });

    // Advance past the pause phase (4000ms)
    act(() => jest.advanceTimersByTime(4000));

    // First deletion tick — should show cursor
    act(() => jest.advanceTimersByTime(40));
    expect(mockInput.placeholder).toContain('|');
  });
});
