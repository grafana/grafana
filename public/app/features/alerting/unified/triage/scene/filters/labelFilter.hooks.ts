import { useState } from 'react';

/**
 * Manages the open/closed state of label key sections in the sidebar.
 *
 * Three signals determine whether a section is open, in descending priority:
 *  1. forcedOpen  — user explicitly expanded via the chevron.
 *  2. hasSearchHit — a fuzzy value-match from the local text filter forces the section open,
 *                    overriding a manual collapse so matched values are always visible.
 *  3. hasExactFilter — an active scene-level '=' matcher (user clicked a value button) keeps
 *                      the section open independently of the text filter.
 *  4. forcedClosed — user explicitly collapsed via the chevron (only applies when no
 *                    search hit is driving the section open).
 */
export function useLabelSectionOpen(exactFilterKeys: Set<string>, valueMatchKeys: Set<string>) {
  const [forcedOpen, setForcedOpen] = useState<Set<string>>(new Set());
  const [forcedClosed, setForcedClosed] = useState<Set<string>>(new Set());

  const isOpen = (key: string): boolean => {
    const hasExactFilter = exactFilterKeys.has(key);
    const hasSearchHit = valueMatchKeys.has(key);
    let open = hasExactFilter || hasSearchHit;
    if (forcedClosed.has(key) && !hasSearchHit) {
      open = false;
    } else if (forcedOpen.has(key)) {
      open = true;
    }
    return open;
  };

  const toggle = (key: string) => {
    const currentlyOpen = isOpen(key);
    if (currentlyOpen) {
      setForcedOpen((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      setForcedClosed((prev) => new Set(prev).add(key));
    } else {
      setForcedClosed((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      setForcedOpen((prev) => new Set(prev).add(key));
    }
  };

  /** Remove a forced-closed override so the filter-driven open state takes effect. */
  const clearForcedClosed = (key: string) => {
    setForcedClosed((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  return { isOpen, toggle, clearForcedClosed };
}
