import { useEffect, useState } from 'react';

type DelayOptions = { min?: number; after?: number };
export function useDelayedSwitch(value: boolean, { min = 250, after = 250 }: DelayOptions = {}): boolean {
  const [delayedValue, setDelayedValue] = useState(value);
  useEffect(() => {
    const timeout = setTimeout(() => setDelayedValue(value), value ? after : min);
    return () => clearTimeout(timeout);
  }, [value, after, min]);

  return delayedValue;
}
