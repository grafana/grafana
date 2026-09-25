import { useEffect, useState } from 'react';

export type RuleListChannel = 'alert' | 'recording';

/**
 * Explicit refresh signal for the active-rule search chains: POST search results are RTK
 * Query mutations, so tag invalidation never refetches them on its own (see
 * `useContinuationSearch`'s `resetKey`). A mutation that changes visible rules (Pause/Resume,
 * Delete, Create, Restore) calls `refreshRuleLists(channel)`; pages fold the returned version
 * into their `resetKey` so every open chain (List and every expanded folder) restarts at page
 * one, and enrichment caches are cleared so a mutated rule's/folder's cached data cannot outlive it.
 */
const versions: Record<RuleListChannel, number> = { alert: 0, recording: 0 };
const listeners: Record<RuleListChannel, Set<() => void>> = { alert: new Set(), recording: new Set() };

export function refreshRuleLists(channel: RuleListChannel): void {
  versions[channel] += 1;
  for (const listener of listeners[channel]) {
    listener();
  }
}

export function useRuleListRefreshVersion(channel: RuleListChannel): number {
  const [version, setVersion] = useState(versions[channel]);

  useEffect(() => {
    const listener = () => setVersion(versions[channel]);
    listeners[channel].add(listener);
    return () => {
      listeners[channel].delete(listener);
    };
  }, [channel]);

  return version;
}

/** Test-only: resets every channel's version and listeners so tests don't leak state. */
export function _resetRuleListRefreshForTests(): void {
  versions.alert = 0;
  versions.recording = 0;
  listeners.alert.clear();
  listeners.recording.clear();
}
