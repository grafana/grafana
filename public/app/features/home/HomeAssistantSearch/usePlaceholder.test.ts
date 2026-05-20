import { renderHook, act } from '@testing-library/react';

import { usePlaceholder } from './usePlaceholder';

describe('usePlaceholder', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns a static limit message when limit is reached', () => {
    const { result } = renderHook(() => usePlaceholder(true));
    const [, full, initial] = result.current;

    expect(full).toMatch(/monthly limit/i);
    expect(initial).toBe(full);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('cycles through example prompts when limit is not reached', () => {
    const { result } = renderHook(() => usePlaceholder(false));

    const firstExample = result.current[1];
    expect(firstExample).toBeTruthy();

    // Run enough ticks to advance past one full cycle
    for (let i = 0; i < 200; i++) {
      act(() => jest.runOnlyPendingTimers());
    }

    // After cycling, the active prompt should have changed
    expect(result.current[1]).not.toBe(firstExample);
  });

  it('shows cursor character during typing animation', () => {
    const mockInput = { placeholder: '' } as HTMLInputElement;
    renderHook(() => {
      const [ref] = usePlaceholder(false);
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
