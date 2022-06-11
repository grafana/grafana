import { useEffect, useRef, useState } from 'react';
import { Observable } from 'rxjs';

import { Field, locationUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';

import { QueryResponse } from '../service';

// Using '*' for uid will return true if anything is selected
export type SelectionChecker = (kind: string, uid: string) => boolean;
export type SelectionToggle = (kind: string, uid: string) => void;

export interface SearchSelection {
  // Check if an item is selected
  isSelected: SelectionChecker;

  // Selected items by kind
  items: Map<string, Set<string>>;
}

export function newSearchSelection(): SearchSelection {
  // the check is called often, on potentially large (all) results so using Map/Set is better than simple array
  const items = new Map<string, Set<string>>();

  const isSelected = (kind: string, uid: string) => {
    return Boolean(items.get(kind)?.has(uid));
  };

  return {
    items,
    isSelected,
  };
}

export function updateSearchSelection(
  old: SearchSelection,
  selected: boolean,
  kind: string,
  uids: string[]
): SearchSelection {
  const items = old.items; // mutate! :/

  if (uids.length) {
    const k = items.get(kind);
    if (k) {
      for (const uid of uids) {
        if (selected) {
          k.add(uid);
        } else {
          k.delete(uid);
        }
      }
      if (k.size < 1) {
        items.delete(kind);
      }
    } else if (selected) {
      items.set(kind, new Set<string>(uids));
    }
  }

  return {
    items,
    isSelected: (kind: string, uid: string) => {
      if (uid === '*') {
        if (kind === '*') {
          for (const k of items.keys()) {
            if (items.get(k)?.size) {
              return true;
            }
          }
          return false;
        }
        return Boolean(items.get(kind)?.size);
      }
      return Boolean(items.get(kind)?.has(uid));
    },
  };
}
interface ItemSelection {
  x: number;
  y: number;
}

export function useSearchGridKeyboardNavigation(
  keyboardEvents: Observable<React.KeyboardEvent>,
  numColumns: number,
  response: QueryResponse
): ItemSelection {
  const highlightIndexRef = useRef<ItemSelection>({ x: 0, y: -1 });
  const [highlightIndex, setHighlightIndex] = useState<ItemSelection>({ x: 0, y: 0 });
  const urlsRef = useRef<Field>();

  // Scroll to the top and clear loader cache when the query results change
  useEffect(() => {
    urlsRef.current = response.view.fields.url;
  }, [response]);

  useEffect(() => {
    const sub = keyboardEvents.subscribe({
      next: (keyEvent) => {
        switch (keyEvent?.code) {
          case 'ArrowDown': {
            highlightIndexRef.current.y++;
            setHighlightIndex({
              y: highlightIndexRef.current.y,
              x: highlightIndexRef.current.x,
            });
            break;
          }
          case 'ArrowUp':
            highlightIndexRef.current.y = Math.max(0, highlightIndexRef.current.y - 1);
            setHighlightIndex({
              y: highlightIndexRef.current.y,
              x: highlightIndexRef.current.x,
            });
            break;
          case 'ArrowRight': {
            highlightIndexRef.current.x = Math.min(numColumns, highlightIndexRef.current.x + 1);
            setHighlightIndex({
              y: highlightIndexRef.current.y,
              x: highlightIndexRef.current.x,
            });
            break;
          }
          case 'ArrowLeft': {
            highlightIndexRef.current.x = Math.max(0, highlightIndexRef.current.x - 1);
            setHighlightIndex({
              y: highlightIndexRef.current.y,
              x: highlightIndexRef.current.x,
            });
            break;
          }
          case 'Enter':
            if (highlightIndexRef.current.y >= 0 && urlsRef.current) {
              const idx = highlightIndexRef.current.x * numColumns + highlightIndexRef.current.y;
              const url = urlsRef.current.values?.get(idx) as string;
              if (url) {
                locationService.push(locationUtil.stripBaseFromUrl(url));
              }
            }
        }
      },
    });

    return () => sub.unsubscribe();
  }, [keyboardEvents, numColumns]);

  return highlightIndex;
}

export function useSearchTableKeyboardNavigation(
  keyboardEvents: Observable<React.KeyboardEvent>,
  response: QueryResponse
): { highlightIndex: number; highlightIndexRef: React.MutableRefObject<number> } {
  const highlightIndexRef = useRef<number>(-1);
  const [highlightIndex, setHighlightIndex] = useState<number>(-1);
  const urlsRef = useRef<Field>();

  // Scroll to the top and clear loader cache when the query results change
  useEffect(() => {
    urlsRef.current = response.view.fields.url;
    highlightIndexRef.current = -1;
  }, [response]);

  useEffect(() => {
    const sub = keyboardEvents.subscribe({
      next: (keyEvent) => {
        switch (keyEvent?.code) {
          case 'ArrowDown': {
            highlightIndexRef.current += 1;
            setHighlightIndex(highlightIndexRef.current);
            break;
          }
          case 'ArrowUp':
            highlightIndexRef.current = Math.max(0, highlightIndexRef.current - 1);
            setHighlightIndex(highlightIndexRef.current);
            break;
          case 'Enter':
            if (highlightIndexRef.current >= 0 && urlsRef.current) {
              const url = urlsRef.current.values?.get(highlightIndexRef.current) as string;
              if (url) {
                locationService.push(locationUtil.stripBaseFromUrl(url));
              }
            }
        }
      },
    });

    return () => sub.unsubscribe();
  }, [keyboardEvents]);

  return { highlightIndex, highlightIndexRef };
}
