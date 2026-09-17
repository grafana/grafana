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

  const createEvent = (type: string): Event => {
    const eventConstructors: Record<string, () => Event> = {
      pointerdown: () => new MouseEvent('pointerdown'),
      pointermove: () => new MouseEvent('pointermove'),
      wheel: () => new WheelEvent('wheel'),
      scroll: () => new Event('scroll'),
      keydown: () => new KeyboardEvent('keydown'),
      visibilitychange: () => new Event('visibilitychange'),
    };
    return eventConstructors[type]();
  };

  const dispatchEvent = (type: string) => window.dispatchEvent(createEvent(type));

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

  describe('activity events', () => {
    ['pointerdown', 'pointermove', 'wheel', 'scroll', 'keydown', 'visibilitychange'].forEach((eventType) => {
      it(`should reset timer on ${eventType} event`, () => {
        const { result } = renderHook(() => useUserActivity(3000));

        // Advance time but not enough to trigger inactivity
        act(() => jest.advanceTimersByTime(2500));
        expect(result.current).toBe(true);

        // Trigger event and let all timers complete
        act(() => {
          dispatchEvent(eventType);
          jest.runAllTimers();
        });

        // Should now be inactive after full delay
        expect(result.current).toBe(false);
      });
    });
  });

  describe('event throttling', () => {
    it('should throttle all events with requestAnimationFrame', () => {
      renderHook(() => useUserActivity(3000));
      const spy = jest.spyOn(window, 'requestAnimationFrame');

      act(() => {
        // Dispatch multiple events rapidly
        dispatchEvent('pointerdown');
        dispatchEvent('pointermove');
        dispatchEvent('scroll');
        dispatchEvent('wheel');
        dispatchEvent('keydown');
      });

      // Only one RAF should be scheduled despite multiple events
      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockRestore();
    });

    it('should process events after RAF callback completes', () => {
      renderHook(() => useUserActivity(3000));
      const rafSpy = jest.spyOn(window, 'requestAnimationFrame');

      // First event
      act(() => dispatchEvent('pointermove'));
      expect(rafSpy).toHaveBeenCalledTimes(1);

      // Complete the RAF and timers
      act(() => jest.runAllTimers());

      // Second event should schedule a new RAF
      act(() => dispatchEvent('scroll'));
      expect(rafSpy).toHaveBeenCalledTimes(2);

      rafSpy.mockRestore();
    });
  });

  describe('cleanup', () => {
    it('should clean up all event listeners on unmount', () => {
      const spy = jest.spyOn(window, 'removeEventListener');
      const { unmount } = renderHook(() => useUserActivity(3000));

      unmount();

      // Verify all event listeners are removed
      expect(spy).toHaveBeenCalledWith('pointerdown', expect.any(Function));
      expect(spy).toHaveBeenCalledWith('pointermove', expect.any(Function));
      expect(spy).toHaveBeenCalledWith('wheel', expect.any(Function), { capture: true, passive: true });
      expect(spy).toHaveBeenCalledWith('scroll', expect.any(Function), { capture: true, passive: true });
      expect(spy).toHaveBeenCalledWith('keydown', expect.any(Function));
      expect(spy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));

      spy.mockRestore();
    });

    it('should cancel pending animation frame on unmount', () => {
      const spy = jest.spyOn(window, 'cancelAnimationFrame');
      const { unmount } = renderHook(() => useUserActivity(3000));

      // Trigger an event to schedule a RAF
      act(() => dispatchEvent('pointermove'));

      unmount();

      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should clear timeout on unmount', () => {
      const spy = jest.spyOn(window, 'clearTimeout');
      const { unmount } = renderHook(() => useUserActivity(3000));

      unmount();

      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('user activity lifecycle', () => {
    it('should handle multiple activity events in sequence', () => {
      const { result } = renderHook(() => useUserActivity(3000));

      // Each event keeps the user active
      act(() => {
        dispatchEvent('pointerdown');
        jest.advanceTimersByTime(1000);
      });

      act(() => {
        dispatchEvent('keydown');
        jest.advanceTimersByTime(1000);
      });

      act(() => {
        dispatchEvent('wheel');
        jest.advanceTimersByTime(1000);
      });

      expect(result.current).toBe(true);

      // Finally let the inactivity timer complete
      act(() => jest.runAllTimers());
      expect(result.current).toBe(false);
    });

    it('should reactivate user after going inactive', () => {
      const { result } = renderHook(() => useUserActivity(3000));

      // User becomes inactive
      act(() => jest.advanceTimersByTime(3000));
      expect(result.current).toBe(false);

      // New activity triggers reactivation and then becomes inactive again
      act(() => {
        dispatchEvent('pointerdown');
        jest.runAllTimers();
      });

      expect(result.current).toBe(false);
    });

    it('should reset timer with each activity event', () => {
      const { result } = renderHook(() => useUserActivity(3000));

      // Keep user active by triggering events before the 3s timeout
      act(() => {
        jest.advanceTimersByTime(2000);
        dispatchEvent('keydown');
        jest.advanceTimersByTime(2000); // Total: 4s but timer was reset
      });

      act(() => {
        dispatchEvent('scroll');
        jest.advanceTimersByTime(2000); // Total: 6s but timer was reset again
      });

      act(() => {
        dispatchEvent('wheel');
        jest.advanceTimersByTime(2000); // Total: 8s but timer was reset again
      });

      // User should still be active because timer kept resetting
      expect(result.current).toBe(true);

      // Now let it expire
      act(() => jest.runAllTimers());
      expect(result.current).toBe(false);
    });

    it('should respect updated delay parameter', () => {
      const { result, rerender } = renderHook(({ delay }) => useUserActivity(delay), {
        initialProps: { delay: 1000 },
      });

      expect(result.current).toBe(true);

      // Advance time but not enough to trigger initial delay
      act(() => jest.advanceTimersByTime(500));
      expect(result.current).toBe(true);

      // Change delay to 2000ms - effect should re-run
      rerender({ delay: 2000 });

      // Advance another 1000ms (total 1500ms from start, but delay was reset on rerender)
      act(() => jest.advanceTimersByTime(1000));
      expect(result.current).toBe(true);

      // Advance remaining time to reach the 2000ms delay
      act(() => jest.advanceTimersByTime(1000));
      expect(result.current).toBe(false);
    });
  });
});
