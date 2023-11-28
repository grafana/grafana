import { useEffect, useRef, useState } from 'react';
import { Subject } from 'rxjs';
import { locationUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
export function useKeyNavigationListener() {
    const eventsRef = useRef(new Subject());
    return {
        keyboardEvents: eventsRef.current,
        onKeyDown: (e) => {
            switch (e.code) {
                case 'ArrowDown':
                case 'ArrowUp':
                case 'ArrowLeft':
                case 'ArrowRight':
                case 'Enter':
                    eventsRef.current.next(e);
                default:
                // ignore
            }
        },
    };
}
export function useSearchKeyboardNavigation(keyboardEvents, numColumns, response) {
    const highlightIndexRef = useRef({ x: 0, y: -1 });
    const [highlightIndex, setHighlightIndex] = useState({ x: 0, y: -1 });
    const urlsRef = useRef();
    // Clear selection when the search results change
    useEffect(() => {
        urlsRef.current = response.view.fields.url;
        highlightIndexRef.current.x = 0;
        highlightIndexRef.current.y = -1;
        setHighlightIndex(Object.assign({}, highlightIndexRef.current));
    }, [response]);
    useEffect(() => {
        const sub = keyboardEvents.subscribe({
            next: (keyEvent) => {
                var _a;
                switch (keyEvent === null || keyEvent === void 0 ? void 0 : keyEvent.code) {
                    case 'ArrowDown': {
                        highlightIndexRef.current.y++;
                        setHighlightIndex(Object.assign({}, highlightIndexRef.current));
                        break;
                    }
                    case 'ArrowUp':
                        highlightIndexRef.current.y = Math.max(0, highlightIndexRef.current.y - 1);
                        setHighlightIndex(Object.assign({}, highlightIndexRef.current));
                        break;
                    case 'ArrowRight': {
                        if (numColumns > 0) {
                            highlightIndexRef.current.x = Math.min(numColumns, highlightIndexRef.current.x + 1);
                            setHighlightIndex(Object.assign({}, highlightIndexRef.current));
                        }
                        break;
                    }
                    case 'ArrowLeft': {
                        if (numColumns > 0) {
                            highlightIndexRef.current.x = Math.max(0, highlightIndexRef.current.x - 1);
                            setHighlightIndex(Object.assign({}, highlightIndexRef.current));
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
                            setHighlightIndex(Object.assign({}, highlightIndexRef.current));
                            break;
                        }
                        const url = (_a = urlsRef.current.values) === null || _a === void 0 ? void 0 : _a[idx];
                        if (url) {
                            locationService.push(locationUtil.stripBaseFromUrl(url));
                        }
                }
            },
        });
        return () => sub.unsubscribe();
    }, [keyboardEvents, numColumns]);
    return highlightIndex;
}
//# sourceMappingURL=useSearchKeyboardSelection.js.map