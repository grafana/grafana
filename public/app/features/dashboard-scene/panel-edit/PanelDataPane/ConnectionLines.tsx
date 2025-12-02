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

  useLayoutEffect(() => {
    const updatePositions = () => {
      const newPositions = new Map<string, DOMRect>();
      const cards = document.querySelectorAll('[data-card-id]');

      cards.forEach((element) => {
        const cardId = element.getAttribute('data-card-id');
        if (cardId) {
          newPositions.set(cardId, element.getBoundingClientRect());
        }
      });

      setPositions(newPositions);
    };

    const timeoutId = setTimeout(updatePositions, 100);
    window.addEventListener('resize', updatePositions);

    const container = containerRef.current?.parentElement;
    if (container) {
      const scrollContainer = container.querySelector('[data-scrollcontainer]');
      scrollContainer?.addEventListener('scroll', updatePositions);

      const observer = new MutationObserver(() => setTimeout(updatePositions, 50));
      observer.observe(container, { childList: true, subtree: true });

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

  const cardIds = new Set<string>();
  connections.forEach(({ from, to }) => {
    cardIds.add(from);
    cardIds.add(to);
  });

  const swimlaneX = containerRect.width - 32;

  const cardPositions: number[] = [];
  cardIds.forEach((cardId) => {
    const cardRect = positions.get(cardId);
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
      <g className={styles.connectionGroup}>
        <line x1={swimlaneX} y1={minY} x2={swimlaneX} y2={maxY} className={styles.swimlane} />
        {Array.from(cardIds).map((cardId) => {
          const cardRect = positions.get(cardId);
          if (!cardRect) {
            return null;
          }
          const pointY = cardRect.top + cardRect.height / 2 - containerRect.top;
          return <circle key={cardId} cx={swimlaneX} cy={pointY} r={4} className={styles.point} />;
        })}
      </g>
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
  connectionGroup: css({
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
    },
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
