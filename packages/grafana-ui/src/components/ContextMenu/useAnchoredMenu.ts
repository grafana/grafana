import { useEffect, useMemo, useRef, useState } from 'react';

import { SCROLL_DISMISS_DISTANCE } from '../../utils/floating';

export interface MenuAnchor {
  clientX: number;
  clientY: number;
  contextElement?: Element;
}

export function useAnchoredMenu(anchor: MenuAnchor | undefined, onClose?: () => void) {
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);

  const reference = useMemo(() => {
    if (!anchor) {
      return undefined;
    }
    const { clientX, clientY, contextElement } = anchor;
    const initialRect = contextElement?.getBoundingClientRect();
    return {
      contextElement,
      getBoundingClientRect() {
        const rect = contextElement?.getBoundingClientRect();
        const x = clientX + (rect && initialRect ? rect.left - initialRect.left : 0);
        const y = clientY + (rect && initialRect ? rect.top - initialRect.top : 0);
        return { x, y, left: x, top: y, right: x, bottom: y, width: 0, height: 0 };
      },
    };
  }, [anchor]);

  const [tracked, setTracked] = useState<{ anchor: MenuAnchor; x: number; y: number }>();

  useEffect(() => {
    if (!anchor || !reference?.contextElement) {
      return;
    }
    let dismissed = false;
    const update = () => {
      if (dismissed) {
        return;
      }
      const { x, y } = reference.getBoundingClientRect();
      if (
        !reference.contextElement?.isConnected ||
        Math.abs(x - anchor.clientX) > SCROLL_DISMISS_DISTANCE ||
        Math.abs(y - anchor.clientY) > SCROLL_DISMISS_DISTANCE
      ) {
        dismissed = true;
        close.current?.();
        return;
      }
      setTracked({ anchor, x, y });
    };

    // Capture includes scrolling inside dashboard and panel containers.
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [anchor, reference]);

  return {
    reference,
    position: tracked && tracked.anchor === anchor ? tracked : { x: anchor?.clientX ?? 0, y: anchor?.clientY ?? 0 },
  };
}
