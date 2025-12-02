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
}

export function ConnectionLines({ connections }: ConnectionLinesProps) {
  const styles = useStyles2(getStyles);
  const [positions, setPositions] = useState<Map<string, DOMRect>>(new Map());
  const containerRef = useRef<SVGSVGElement>(null);

  // Update positions when cards change
  useLayoutEffect(() => {
    const updatePositions = () => {
      const newPositions = new Map<string, DOMRect>();

      // Find all cards by their data-card-id attribute
      const cards = document.querySelectorAll('[data-card-id]');

      cards.forEach((element) => {
        const cardId = element.getAttribute('data-card-id');
        if (cardId) {
          const rect = element.getBoundingClientRect();
          newPositions.set(cardId, rect);
        }
      });

      setPositions(newPositions);
    };

    // Delay to ensure cards are rendered
    const timeoutId = setTimeout(updatePositions, 100);

    // Update on resize and scroll
    window.addEventListener('resize', updatePositions);

    const container = containerRef.current?.parentElement;
    if (container) {
      // Watch for scroll events
      const scrollContainer = container.querySelector('[data-scrollcontainer]');
      scrollContainer?.addEventListener('scroll', updatePositions);

      // Watch for DOM changes
      const observer = new MutationObserver(() => {
        setTimeout(updatePositions, 50);
      });
      observer.observe(container, { childList: true, subtree: true });

      // Watch for container resize (splitter changes)
      const resizeObserver = new ResizeObserver(updatePositions);
      resizeObserver.observe(container);

      return () => {
        clearTimeout(timeoutId);
        window.removeEventListener('resize', updatePositions);
        scrollContainer?.removeEventListener('scroll', updatePositions);
        observer.disconnect();
        resizeObserver.disconnect();
      };
    }

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', updatePositions);
    };
  }, [connections]);

  const containerRect = containerRef.current?.parentElement?.getBoundingClientRect();

  if (!containerRect || connections.length === 0) {
    return <svg ref={containerRef} className={styles.svg} />;
  }

  // Group connections by expression (each "to" card gets its own lane)
  const lanesByExpression = new Map<string, Set<string>>();

  connections.forEach((conn) => {
    if (!lanesByExpression.has(conn.to)) {
      lanesByExpression.set(conn.to, new Set());
    }
    const lane = lanesByExpression.get(conn.to)!;
    lane.add(conn.from); // Add the referenced query
    lane.add(conn.to); // Add the expression itself
  });

  // Convert to array of lanes
  const activeLanes = Array.from(lanesByExpression.values());

  // Find the rightmost edge of all cards
  let maxCardRight = 0;
  positions.forEach((rect) => {
    const cardRight = rect.right - containerRect.left;
    if (cardRight > maxCardRight) {
      maxCardRight = cardRight;
    }
  });

  const laneSpacing = 16; // Spacing between lanes (must match QueryTransformList.tsx)
  const baseOffset = 24; // Offset from rightmost card (must match QueryTransformList.tsx)

  return (
    <svg ref={containerRef} className={styles.svg}>
      {activeLanes.map((lane, laneIndex) => {
        // Calculate Y positions for cards in this lane
        const laneYPositions: number[] = [];
        lane.forEach((cardId) => {
          const cardRect = positions.get(cardId);
          if (cardRect) {
            laneYPositions.push(cardRect.top + cardRect.height / 2 - containerRect.top);
          }
        });

        if (laneYPositions.length === 0) {
          return null;
        }

        // Calculate swimlane X position for this lane (start from rightmost card edge)
        const swimlaneX = maxCardRight + baseOffset + laneIndex * laneSpacing;

        // Find min/max Y to draw the line only between connected points
        const minY = Math.min(...laneYPositions);
        const maxY = Math.max(...laneYPositions);

        return (
          <g key={laneIndex}>
            {/* Vertical swimlane line */}
            <line x1={swimlaneX} y1={minY} x2={swimlaneX} y2={maxY} className={styles.swimlane} />

            {/* Connection points for cards in this lane */}
            {Array.from(lane).map((cardId) => {
              const cardRect = positions.get(cardId);

              if (!cardRect) {
                return null;
              }

              const pointY = cardRect.top + cardRect.height / 2 - containerRect.top;

              return <circle key={cardId} cx={swimlaneX} cy={pointY} r={4} className={styles.point} />;
            })}
          </g>
        );
      })}
    </svg>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  svg: css({
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: 10,
    overflow: 'visible',
  }),
  swimlane: css({
    stroke: theme.colors.text.maxContrast,
    strokeWidth: 2,
    opacity: 0.3,
  }),
  point: css({
    fill: theme.colors.text.maxContrast,
    opacity: 0.8,
  }),
});
