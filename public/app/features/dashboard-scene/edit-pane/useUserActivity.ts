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
    const wheelEventOpts = { capture: true, passive: true };

    const setActivityTimer = () => setTimeout(() => setIsUserActive(false), delay);

    const handleActivity = () => {
      setIsUserActive(true);
      clearTimeout(timeout);
      timeout = setActivityTimer();
    };

    const handleMouseMove = () => {
      if (rafId !== null) {
        return;
      }

      rafId = requestAnimationFrame(() => {
        rafId = null;
        handleActivity();
      });
    };

    window.addEventListener('click', handleActivity, otherEventsOpts);
    window.addEventListener('wheel', handleActivity, wheelEventOpts);
    window.addEventListener('mousemove', handleMouseMove, otherEventsOpts);
    window.addEventListener('keydown', handleActivity, otherEventsOpts);
    window.addEventListener('visibilitychange', handleActivity);

    timeout = setActivityTimer();

    return () => {
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('wheel', handleActivity, wheelEventOpts);
      window.removeEventListener('mousemove', handleMouseMove);
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
