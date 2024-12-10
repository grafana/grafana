import { useState, useRef, useEffect } from 'react';

export function useActiveIndex(items: Array<{ type: 'divider' | 'result' }>): number {
  const [_activeIndex, setActiveIndex] = useState(() => {
    const firstResultIndex = items.findIndex((item) => item.type === 'result');
    return firstResultIndex === -1 ? 0 : firstResultIndex;
  });

  let activeIndex = _activeIndex;

  if (activeIndex < 0) {
    if (items[0]?.type === 'divider') {
      activeIndex = 1;
    }
  } else if (activeIndex >= items.length) {
    activeIndex = items.length - 1;
  }

  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;
  useEffect(() => {
    function handler(event: KeyboardEvent) {
      const activeIndex = activeIndexRef.current;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        event.stopPropagation();
        let newIndex = Math.min(activeIndex + 1, items.length - 1);

        const newIndexItem = items[newIndex];
        if (newIndexItem.type === 'divider') {
          newIndex += 1;
        }

        setActiveIndex(newIndex);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        event.stopPropagation();
        let newIndex = Math.max(activeIndex - 1, 0);

        const newIndexItem = items[newIndex];
        if (newIndexItem.type === 'divider') {
          newIndex -= 1;
        }

        setActiveIndex(newIndex);
      }
    }

    window.addEventListener('keydown', handler);

    return () => {
      window.removeEventListener('keydown', handler);
    };
  }, [items]);

  return activeIndex;
}
