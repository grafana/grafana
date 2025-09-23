import { useCallback, useEffect, useRef } from 'react';

import { logger } from 'app/percona/shared/helpers/logger';

type hookRecurringCallback = () => void;

export const useRecurringCall = () => {
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const interval = useRef<number>();

  const stopTimeout = useCallback(() => {
    !!timer.current && clearTimeout(timer.current);
  }, []);

  const triggerTimeout = useCallback(
    async (cb: hookRecurringCallback, defaultInterval = 10000, callImmediate = false) => {
      interval.current = defaultInterval;
      try {
        callImmediate && (await cb());
        stopTimeout();
        timer.current = setTimeout(async () => {
          await cb();
          triggerTimeout(cb, interval.current);
        }, interval.current);
      } catch (e) {
        logger.error(e);
        triggerTimeout(cb, interval.current);
      }
    },
    [stopTimeout]
  );

  const changeInterval = useCallback((newInterval: number) => {
    interval.current = newInterval;
  }, []);

  useEffect(() => {
    return stopTimeout;
  }, [stopTimeout]);

  return [triggerTimeout, changeInterval, stopTimeout] as const;
};
