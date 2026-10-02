import { useEffect, useState } from 'react';

/**
 * Tracks user activity and returns whether the user is currently active.
 * User is considered active when they interact with the page via click, scroll,
 * keyboard, or mouse movement. Becomes inactive after the specified delay.
 */
export function useUserActivity(delay: number): boolean {
  const [isUserActive, setIsUserActive] = useState(true);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    let rafId: number | null = null;
    const otherEventsOpts = { passive: true };
    const scrollEventOpts = { capture: true, passive: true };

    const setActivityTimer = () => setTimeout(() => setIsUserActive(false), delay);

    const handleActivity = () => {
      if (rafId !== null) {
        return;
      }

      rafId = requestAnimationFrame(() => {
        rafId = null;
        setIsUserActive(true);
        clearTimeout(timeout);
        timeout = setActivityTimer();
      });
    };

    // Using pointer events instead of mouse events for more comprehensive input support
    window.addEventListener('pointerdown', handleActivity, otherEventsOpts);
    window.addEventListener('pointermove', handleActivity, otherEventsOpts);

    // Wheel events refer to mouse wheel scrolling while scroll events refer to any scrolling (e.g. touchpad, mobile etc.)
    // Wheel and scroll events can be passive and need to be captured to avoid missing them
    window.addEventListener('wheel', handleActivity, scrollEventOpts);
    window.addEventListener('scroll', handleActivity, scrollEventOpts);

    // Keyboard events
    window.addEventListener('keydown', handleActivity, otherEventsOpts);

    // Consider browser tab changes as activity
    window.addEventListener('visibilitychange', handleActivity);

    timeout = setActivityTimer();

    return () => {
      window.removeEventListener('pointerdown', handleActivity);
      window.removeEventListener('pointermove', handleActivity);
      window.removeEventListener('wheel', handleActivity, scrollEventOpts);
      window.removeEventListener('scroll', handleActivity, scrollEventOpts);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('visibilitychange', handleActivity);

      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }

      clearTimeout(timeout);
    };
  }, [delay]);

  return isUserActive;
}
