import { css } from '@emotion/css';
import { useLayoutEffect, useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

interface Connection {
  from: string;
  to: string;
}

interface ConnectionLinesProps {
  connections: Connection[];
  isDragging?: boolean;
  onClick?: () => void;
  selected?: boolean;
}

export function ConnectionLines({ connections, isDragging = false, selected, onClick }: ConnectionLinesProps) {
  const styles = useStyles2(getStyles, selected);
  const [positions, setPositions] = useState<Map<string, DOMRect>>(new Map());
  const containerRef = useRef<SVGSVGElement>(null);

  useLayoutEffect(() => {
    let rafId: number | null = null;
    let isUpdating = false;

    const updatePositions = () => {
      if (isUpdating) {
        return;
      }

      isUpdating = true;
      rafId = requestAnimationFrame(() => {
        const newPositions = new Map<string, DOMRect>();
        const cards = document.querySelectorAll('[data-card-id]');

        cards.forEach((element) => {
          const cardId = element.getAttribute('data-card-id');
          if (cardId) {
            newPositions.set(cardId, element.getBoundingClientRect());
          }
        });

        setPositions(newPositions);
        isUpdating = false;
      });
    };

    // Initial update and update when drag ends
    if (!isDragging) {
      updatePositions();
    }

    const container = containerRef.current?.parentElement;
    if (container) {
      // Only observe mutations when not dragging (for card add/remove/reorder)
      let mutationTimeout: number | null = null;
      const observer = new MutationObserver(() => {
        if (isDragging) {
          return;
        }
        if (mutationTimeout) {
          clearTimeout(mutationTimeout);
        }
        mutationTimeout = window.setTimeout(updatePositions, 50);
      });
      observer.observe(container, { childList: true, subtree: true });

      // Track container resize (from splitter drag)
      const resizeObserver = new ResizeObserver(updatePositions);
      resizeObserver.observe(container);

      return () => {
        if (rafId) {
          cancelAnimationFrame(rafId);
        }
        if (mutationTimeout) {
          clearTimeout(mutationTimeout);
        }
        observer.disconnect();
        resizeObserver.disconnect();
      };
    }

    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [connections, isDragging]);

  // Get container rect from the SVG's parent (contentWrapper)
  const containerRect = containerRef.current?.parentElement?.getBoundingClientRect();

  if (!containerRect || connections.length === 0) {
    return <svg ref={containerRef} className={styles.svg} />;
  }

  // Helper to find card rect by refId (tries query-X and expression-X formats)
  const findCardRect = (refId: string): DOMRect | undefined => {
    return positions.get(`query-${refId}`) || positions.get(`expression-${refId}`);
  };

  const refIds = new Set<string>();
  connections.forEach(({ from, to }) => {
    refIds.add(from);
    refIds.add(to);
  });

  const swimlaneX = containerRect.width - 24; // Adjusted for increased right padding (48px)

  const cardPositions: number[] = [];
  refIds.forEach((refId) => {
    const cardRect = findCardRect(refId);
    if (cardRect) {
      cardPositions.push(cardRect.top + cardRect.height / 2 - containerRect.top);
    }
  });

  if (cardPositions.length === 0) {
    return <svg ref={containerRef} className={styles.svg} />;
  }

  const minY = Math.min(...cardPositions);
  const maxY = Math.max(...cardPositions);

  return (
    <svg ref={containerRef} className={styles.svg}>
      <g className={styles.connectionGroup} onClick={onClick}>
        <line x1={swimlaneX} y1={minY} x2={swimlaneX} y2={maxY} className={styles.swimlane} />
        {Array.from(refIds).map((refId) => {
          const cardRect = findCardRect(refId);
          if (!cardRect) {
            return null;
          }
          const pointY = cardRect.top + cardRect.height / 2 - containerRect.top;
          return <circle key={refId} cx={swimlaneX} cy={pointY} className={styles.point} />;
        })}
      </g>
    </svg>
  );
}

const getStyles = (theme: GrafanaTheme2, selected?: boolean) => ({
  svg: css({
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    overflow: 'visible',
    pointerEvents: 'none',
    width: '100%',
  }),
  connectionGroup: css({
    pointerEvents: 'auto',
    cursor: 'pointer',
    opacity: 0.7,
    '&:hover': {
      opacity: 1,
    },
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      animation: 'fadeIn 0.2s ease-in-out',
      '@keyframes fadeIn': {
        from: {
          opacity: 0,
        },
        to: {
          opacity: 1,
        },
      },
      transition: theme.transitions.create(['opacity']),
    },
  }),
  swimlane: css({
    stroke: selected ? theme.colors.primary.border : theme.colors.text.maxContrast,
    strokeWidth: 2,
    'g:hover &': {
      strokeWidth: 3,
    },
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: theme.transitions.create(['strokeWidth']),
    },
  }),
  point: css({
    fill: selected ? theme.colors.primary.border : theme.colors.text.maxContrast,
    r: 4,
    'g:hover &': {
      r: 6,
    },
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: theme.transitions.create(['r']),
    },
  }),
});
