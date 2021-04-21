import { logger } from '@percona/platform-core';
import { useRef, useEffect } from 'react';

type hookRecurringCallback = () => void;

export const useRecurringCall = () => {
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const interval = useRef<number>();

  const triggerTimeout = async (cb: hookRecurringCallback, defaultInterval = 10000, callImmediate = false) => {
    interval.current = defaultInterval;
    try {
      callImmediate && (await cb());
      timer.current = setTimeout(async () => {
        await cb();
        triggerTimeout(cb, interval.current);
      }, interval.current);
    } catch (e) {
      logger.error(e);
      triggerTimeout(cb, interval.current);
    }
  };

  const changeInterval = (newInterval: number) => {
    interval.current = newInterval;
  };

  const stopTimeout = () => {
    timer.current && clearTimeout(timer.current);
  };

  useEffect(() => {
    return stopTimeout;
  }, []);

  return [triggerTimeout, changeInterval, stopTimeout] as const;
};
