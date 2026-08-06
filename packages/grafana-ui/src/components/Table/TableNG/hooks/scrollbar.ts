import { debounce } from 'lodash';
import { type RefObject, useLayoutEffect, useState } from 'react';

import { type DataGridHandle } from '@grafana/react-data-grid';

import { IS_SAFARI_26 } from '../styles';

export function useScrollbarWidth(ref: RefObject<DataGridHandle | null>, height: number) {
  const [scrollbarWidth, setScrollbarWidth] = useState(0);

  const updateScrollbarDimensions = debounce(() => {
    const el = ref.current?.element;
    if (el) {
      setScrollbarWidth(el!.offsetWidth - el!.clientWidth);
    }
  }, 150);

  useLayoutEffect(() => {
    const el = ref.current?.element;
    if (!el || IS_SAFARI_26) {
      return;
    }

    updateScrollbarDimensions();

    const resizeObserver = new ResizeObserver(updateScrollbarDimensions);
    resizeObserver.observe(el);
    return () => {
      resizeObserver.disconnect();
    };
  }, [ref, height, updateScrollbarDimensions]);

  return scrollbarWidth;
}
