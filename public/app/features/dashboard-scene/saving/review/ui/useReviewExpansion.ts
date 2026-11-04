import { useState } from 'react';

export interface ReviewExpansion {
  isExpanded(key: string): boolean;
  toggle(key: string): void;
  setAll(expanded: boolean): void;
}

/**
 * Open/closed state of every collapsible part of the Review, by key. Expand all and Collapse all set
 * one value for everything; toggling a single part afterwards overrides it for that part only.
 */
export function useReviewExpansion(defaultExpanded: (key: string) => boolean): ReviewExpansion {
  const [all, setAllState] = useState<boolean | undefined>(undefined);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  const isExpanded = (key: string) => overrides[key] ?? all ?? defaultExpanded(key);

  return {
    isExpanded,
    toggle: (key) => setOverrides((previous) => ({ ...previous, [key]: !isExpanded(key) })),
    setAll: (expanded) => {
      setAllState(expanded);
      setOverrides({});
    },
  };
}
