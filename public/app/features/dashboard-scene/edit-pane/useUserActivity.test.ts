import { renderHook, act } from '@testing-library/react';

import { useUserActivity } from './useUserActivity';

describe('useUserActivity', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => jest.runOnlyPendingTimers());
    jest.useRealTimers();
  });

  it('should start with user active', () => {
    const { result } = renderHook(() => useUserActivity(3000));
    expect(result.current).toBe(true);
  });

  it('should set user inactive after delay', () => {
    const { result } = renderHook(() => useUserActivity(3000));
    expect(result.current).toBe(true);
    act(() => jest.advanceTimersByTime(3000));
    expect(result.current).toBe(false);
  });

  it('should reset timer on click event', () => {
    const { result } = renderHook(() => useUserActivity(3000));
    act(() => jest.advanceTimersByTime(2000));
    expect(result.current).toBe(true);
    act(() => {
      window.dispatchEvent(new MouseEvent('click'));
      jest.advanceTimersByTime(2000);
    });
    expect(result.current).toBe(true);
    act(() => jest.advanceTimersByTime(1000));
    expect(result.current).toBe(false);
  });

  it('should reset timer on wheel event', () => {
    const { result } = renderHook(() => useUserActivity(3000));
    act(() => jest.advanceTimersByTime(2500));
    act(() => {
      window.dispatchEvent(new WheelEvent('wheel'));
      jest.advanceTimersByTime(2500);
    });
    expect(result.current).toBe(true);
  });

  it('should reset timer on keydown event', () => {
    const { result } = renderHook(() => useUserActivity(3000));
    act(() => jest.advanceTimersByTime(2500));
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown'));
      jest.advanceTimersByTime(2500);
    });
    expect(result.current).toBe(true);
  });

  it('should reset timer on visibilitychange event', () => {
    const { result } = renderHook(() => useUserActivity(3000));
    act(() => jest.advanceTimersByTime(2500));
    act(() => {
      window.dispatchEvent(new Event('visibilitychange'));
      jest.advanceTimersByTime(2500);
    });
    expect(result.current).toBe(true);
  });

  it('should throttle mousemove events with requestAnimationFrame', () => {
    renderHook(() => useUserActivity(3000));
    const rafSpy = jest.spyOn(window, 'requestAnimationFrame');
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove'));
      window.dispatchEvent(new MouseEvent('mousemove'));
      window.dispatchEvent(new MouseEvent('mousemove'));
    });
    expect(rafSpy).toHaveBeenCalledTimes(1);
    rafSpy.mockRestore();
  });

  it('should handle mousemove after animation frame completes', () => {
    const { result } = renderHook(() => useUserActivity(3000));
    act(() => {
      jest.advanceTimersByTime(2500);
      window.dispatchEvent(new MouseEvent('mousemove'));
      jest.advanceTimersByTime(500);
    });
    expect(result.current).toBe(true);
    act(() => jest.advanceTimersByTime(3000));
    expect(result.current).toBe(false);
  });

  it('should clean up event listeners on unmount', () => {
    const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useUserActivity(3000));
    unmount();
    expect(removeEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('wheel', expect.any(Function), {
      capture: true,
      passive: true,
    });
    expect(removeEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    removeEventListenerSpy.mockRestore();
  });

  it('should cancel pending animation frame on unmount', () => {
    const cancelAnimationFrameSpy = jest.spyOn(window, 'cancelAnimationFrame');
    const { unmount } = renderHook(() => useUserActivity(3000));
    act(() => window.dispatchEvent(new MouseEvent('mousemove')));
    unmount();
    expect(cancelAnimationFrameSpy).toHaveBeenCalled();
    cancelAnimationFrameSpy.mockRestore();
  });

  it('should clear timeout on unmount', () => {
    const clearTimeoutSpy = jest.spyOn(window, 'clearTimeout');
    const { unmount } = renderHook(() => useUserActivity(3000));
    unmount();
    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it('should handle multiple activity events in sequence', () => {
    const { result } = renderHook(() => useUserActivity(3000));
    act(() => {
      window.dispatchEvent(new MouseEvent('click'));
      jest.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(true);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown'));
      jest.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(true);
    act(() => {
      window.dispatchEvent(new WheelEvent('wheel'));
      jest.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(true);
    act(() => jest.advanceTimersByTime(3000));
    expect(result.current).toBe(false);
  });

  it('should reactivate user after going inactive', () => {
    const { result } = renderHook(() => useUserActivity(3000));
    act(() => jest.advanceTimersByTime(3000));
    expect(result.current).toBe(false);
    act(() => window.dispatchEvent(new MouseEvent('click')));
    expect(result.current).toBe(true);
    act(() => jest.advanceTimersByTime(3000));
    expect(result.current).toBe(false);
  });
});
