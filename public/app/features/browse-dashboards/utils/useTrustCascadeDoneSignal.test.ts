import { renderHook } from 'test/test-utils';

import { useTrustCascadeDoneSignal } from './useTrustCascadeDoneSignal';

describe('useTrustCascadeDoneSignal', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('trusts a done signal immediately once the item has been observed mid-cascade', () => {
    const { result, rerender } = renderHook(({ isStillDeleting }) => useTrustCascadeDoneSignal(isStillDeleting), {
      initialProps: { isStillDeleting: true },
    });
    expect(result.current).toBe(true);

    rerender({ isStillDeleting: false });
    expect(result.current).toBe(true);
  });

  it('does not trust a done signal right away if mid-cascade was never observed', () => {
    const { result } = renderHook(({ isStillDeleting }) => useTrustCascadeDoneSignal(isStillDeleting), {
      initialProps: { isStillDeleting: false },
    });

    expect(result.current).toBe(false);
  });

  it('eventually trusts it anyway once the grace period elapses', () => {
    jest.useFakeTimers();

    const { result, rerender } = renderHook(({ isStillDeleting }) => useTrustCascadeDoneSignal(isStillDeleting), {
      initialProps: { isStillDeleting: false },
    });
    expect(result.current).toBe(false);

    jest.advanceTimersByTime(5000);
    rerender({ isStillDeleting: false });

    expect(result.current).toBe(true);
  });
});
