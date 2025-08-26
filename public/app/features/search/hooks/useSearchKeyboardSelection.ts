import { useEffect, useRef, useState } from 'react';
import { Observable, Subject } from 'rxjs';

import { Field, locationUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';

import { QueryResponse } from '../service/types';

export function useKeyNavigationListener() {
  const eventsRef = useRef(new Subject<React.KeyboardEvent>());
  return {
    keyboardEvents: eventsRef.current,
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
      switch (e.code) {
        case 'ArrowDown':
        case 'ArrowUp':
        case 'ArrowLeft':
        case 'ArrowRight':
        case 'Enter':
        case 'Escape':
          eventsRef.current.next(e);
        default:
        // ignore
      }
    },
  };
}

interface ItemSelection {
  x: number;
  y: number;
}

export function useSearchKeyboardNavigation(
  keyboardEvents: Observable<React.KeyboardEvent>,
  numColumns: number,
  response: QueryResponse
): ItemSelection {
  const highlightIndexRef = useRef<ItemSelection>({ x: 0, y: -1 });
  const [highlightIndex, setHighlightIndex] = useState<ItemSelection>({ x: 0, y: -1 });
  const urlsRef = useRef<Field>();

  // Clear selection when the search results change
  useEffect(() => {
    urlsRef.current = response.view.fields.url;
    highlightIndexRef.current.x = 0;
    highlightIndexRef.current.y = -1;
    setHighlightIndex({ ...highlightIndexRef.current });
  }, [response]);

  useEffect(() => {
    const sub = keyboardEvents.subscribe({
      next: (keyEvent) => {
        switch (keyEvent?.code) {
          case 'ArrowDown': {
            highlightIndexRef.current.y++;
            setHighlightIndex({ ...highlightIndexRef.current });
            break;
          }
          case 'ArrowUp':
            highlightIndexRef.current.y = Math.max(0, highlightIndexRef.current.y - 1);
            setHighlightIndex({ ...highlightIndexRef.current });
            break;
          case 'ArrowRight': {
            if (numColumns > 0) {
              highlightIndexRef.current.x = Math.min(numColumns, highlightIndexRef.current.x + 1);
              setHighlightIndex({ ...highlightIndexRef.current });
            }
            break;
          }
          case 'ArrowLeft': {
            if (numColumns > 0) {
              highlightIndexRef.current.x = Math.max(0, highlightIndexRef.current.x - 1);
              setHighlightIndex({ ...highlightIndexRef.current });
            }
            break;
          }
          case 'Enter':
            if (!urlsRef.current) {
              break;
            }
            const idx = highlightIndexRef.current.x * numColumns + highlightIndexRef.current.y;
            if (idx < 0) {
              highlightIndexRef.current.x = 0;
              highlightIndexRef.current.y = 0;
              setHighlightIndex({ ...highlightIndexRef.current });
              break;
            }
            const url: unknown = urlsRef.current.values?.[idx];
            if (typeof url === 'string') {
              locationService.push(locationUtil.stripBaseFromUrl(url));
            }
        }
      },
    });

    return () => sub.unsubscribe();
  }, [keyboardEvents, numColumns]);

  return highlightIndex;
}
