import { useState } from 'react';
import { useInterval } from 'react-use';

/** Current time in ms, refreshed every `intervalMs`. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(Date.now);
  useInterval(() => setNow(Date.now()), intervalMs);
  return now;
}
