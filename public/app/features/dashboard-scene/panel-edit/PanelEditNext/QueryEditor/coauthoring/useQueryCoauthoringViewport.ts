import { useLayoutEffect, useState } from 'react';

const VIEWPORT_MARGIN = 8;

export function useQueryCoauthoringViewport(portalTarget: HTMLElement): number | undefined {
  const [availableHeight, setAvailableHeight] = useState<number>();

  useLayoutEffect(() => {
    const updateAvailableHeight = () => {
      const anchorTop = Math.max(portalTarget.getBoundingClientRect().top, 0);
      setAvailableHeight(Math.max(window.innerHeight - anchorTop - VIEWPORT_MARGIN, 0));
    };

    let firstSettleFrame: number | undefined;
    let secondSettleFrame: number | undefined;
    const cancelSettle = () => {
      if (firstSettleFrame !== undefined) {
        cancelAnimationFrame(firstSettleFrame);
        firstSettleFrame = undefined;
      }
      if (secondSettleFrame !== undefined) {
        cancelAnimationFrame(secondSettleFrame);
        secondSettleFrame = undefined;
      }
    };
    const settleAvailableHeight = () => {
      cancelSettle();
      firstSettleFrame = requestAnimationFrame(() => {
        firstSettleFrame = undefined;
        updateAvailableHeight();
        secondSettleFrame = requestAnimationFrame(() => {
          secondSettleFrame = undefined;
          updateAvailableHeight();
        });
      });
    };
    const resizeObserver = new ResizeObserver(() => {
      updateAvailableHeight();
      settleAvailableHeight();
    });
    const updateForViewportChange = (event: Event) => {
      if (event.type === 'scroll' && event.target instanceof Node && portalTarget.contains(event.target)) {
        return;
      }
      updateAvailableHeight();
      settleAvailableHeight();
    };

    updateAvailableHeight();
    settleAvailableHeight();
    resizeObserver.observe(portalTarget);
    window.addEventListener('resize', updateForViewportChange);
    window.addEventListener('scroll', updateForViewportChange, true);
    return () => {
      resizeObserver.disconnect();
      cancelSettle();
      window.removeEventListener('resize', updateForViewportChange);
      window.removeEventListener('scroll', updateForViewportChange, true);
    };
  }, [portalTarget]);

  return availableHeight;
}
