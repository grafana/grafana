import { css } from '@emotion/css';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useStyles2, useTheme2 } from '@grafana/ui';

import { buildArrowPath, centerOf } from '../lib/chainGeometry';

interface Props {
  containerRef: React.RefObject<HTMLDivElement | null>;
  recordingRefs: React.MutableRefObject<Map<string, HTMLDivElement | null>>;
  alertRefs: React.MutableRefObject<Map<string, HTMLDivElement | null>>;
  dependencies: Map<string, string[]>;
  description: string;
}

interface Path {
  key: string;
  d: string;
}

export function DependencyOverlay({ containerRef, recordingRefs, alertRefs, dependencies, description }: Props) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [paths, setPaths] = useState<Path[]>([]);

  const recompute = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const containerRect = container.getBoundingClientRect();
    setSize({ width: containerRect.width, height: containerRect.height });

    const nextPaths: Path[] = [];
    dependencies.forEach((recordings, alertName) => {
      const alertEl = alertRefs.current.get(alertName);
      if (!alertEl) {
        return;
      }
      const alertRect = alertEl.getBoundingClientRect();
      const alertPoint = centerOf(alertRect, containerRect, 'left');
      for (const recordingName of recordings) {
        const recEl = recordingRefs.current.get(recordingName);
        if (!recEl) {
          continue;
        }
        const recRect = recEl.getBoundingClientRect();
        const recPoint = centerOf(recRect, containerRect, 'right');
        nextPaths.push({
          key: `${recordingName}→${alertName}`,
          d: buildArrowPath(recPoint, alertPoint),
        });
      }
    });
    setPaths(nextPaths);
  }, [containerRef, recordingRefs, alertRefs, dependencies]);

  useLayoutEffect(() => {
    recompute();

    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(recompute);
    observer.observe(container);
    return () => observer.disconnect();
  }, [containerRef, recompute]);

  // On initial mount of a chain panel (e.g. when navigating back to a folder)
  // child ref callbacks and layout may not have fully settled by the time the
  // layout effect above runs — this frame-delayed pass ensures we re-measure
  // after the paint cycle completes so arrows render reliably.
  useEffect(() => {
    const handle = requestAnimationFrame(recompute);
    return () => cancelAnimationFrame(handle);
  }, [recompute]);

  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label={t(
        'alerting.rule-list-v2.dependency-overlay.label',
        'Dependencies between recording rules and alert rules'
      )}
      className={styles.svg}
      width={size.width}
      height={size.height}
    >
      <desc>{description}</desc>
      <defs>
        <marker id="arrowhead" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 8 4 L 0 8 z" fill={theme.colors.warning.main} />
        </marker>
      </defs>
      {paths.map((p) => (
        <path
          key={p.key}
          d={p.d}
          stroke={theme.colors.warning.main}
          strokeWidth={1.5}
          opacity={0.7}
          fill="none"
          markerEnd="url(#arrowhead)"
        />
      ))}
    </svg>
  );
}

function getStyles(_theme: GrafanaTheme2) {
  return {
    svg: css({
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
    }),
  };
}
