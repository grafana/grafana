import { useEffect, useRef, useState } from 'react';

type DelayOptions = {
  // Minimal amount of time the switch will be on.
  duration?: number;
  // Delay after which switch will turn on.
  delay?: number;
};

/**
 * Hook that delays changing of boolean switch to prevent too much time spent in "on" state. It is kind of a throttle
 * but you can specify different time for on and off throttling so this only allows a boolean values and also prefers
 * to stay "off" so turning "on" is always delayed while turning "off" is throttled.
 *
 * This is useful for showing loading elements to prevent it flashing too much in case of quick loading time or
 * prevent it flash if loaded state comes right after switch to loading.
 */
export function useDelayedSwitch(value: boolean, options: DelayOptions = {}): boolean {
  const { duration = 250, delay = 250 } = options;

  const [delayedValue, setDelayedValue] = useState(value);
  const onStartTime = useRef<Date | undefined>();

  useEffect(() => {
    let timeout: number | undefined;
    if (value) {
      // If toggling to "on" state we always setTimout no matter how long we have been "off".
      timeout = setTimeout(() => {
        onStartTime.current = new Date();
        setDelayedValue(value);
      }, delay) as any;
    } else {
      // If toggling to "off" state we check how much time we were already "on".
      const timeSpent = onStartTime.current ? Date.now() - onStartTime.current.valueOf() : 0;
      const turnOff = () => {
        onStartTime.current = undefined;
        setDelayedValue(value);
      };
      if (timeSpent >= duration) {
        // We already spent enough time "on" so change right away.
        turnOff();
      } else {
        timeout = setTimeout(turnOff, duration - timeSpent) as any;
      }
    }
    return () => {
      if (timeout) {
        clearTimeout(timeout);
        timeout = undefined;
      }
    };
  }, [value, duration, delay]);

  return delayedValue;
}
