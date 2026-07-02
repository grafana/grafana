import { css, keyframes } from '@emotion/css';
import { memo, useId } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';

import { type PositionedEdge } from '../layout';

interface Props {
  edges: PositionedEdge[];
  width: number;
  height: number;
}

// `edges`/`width`/`height` are already memoized upstream (QueryFlowCanvas), so this skips
// re-rendering the whole SVG layer when the canvas re-renders for unrelated reasons (e.g. selecting
// a node, or a single node's lazy enrichment resolving).
export const QueryFlowEdges = memo(function QueryFlowEdges({ edges, width, height }: Props) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const markerId = `query-flow-arrow-${useId()}`;
  return (
    <svg className={styles.svg} width={width} height={height} aria-hidden>
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M0,0 L10,5 L0,10 z" fill={theme.colors.text.link} />
        </marker>
      </defs>
      {edges.map((edge) => {
        const d = edgePath(edge);
        return (
          <g key={edge.id}>
            <path className={styles.base} d={d} markerEnd={`url(#${markerId})`} />
            <path className={styles.flow} d={d} />
          </g>
        );
      })}
    </svg>
  );
});

// Draw from the child (source data, on the right) toward the parent (result, on the left) so the
// marker-end arrowhead lands on the result node, matching the direction data actually flows.
function edgePath({ source, target }: PositionedEdge): string {
  const midX = (source.x + target.x) / 2;
  return `M${target.x},${target.y} C${midX},${target.y} ${midX},${source.y} ${source.x},${source.y}`;
}

// Marching dashes that travel toward the result (path end), matching the arrowhead direction.
const flowAnimation = keyframes({
  from: { strokeDashoffset: 14 },
  to: { strokeDashoffset: 0 },
});

const getStyles = (theme: GrafanaTheme2) => ({
  svg: css({
    position: 'absolute',
    top: 0,
    left: 0,
    pointerEvents: 'none',
  }),
  base: css({
    fill: 'none',
    stroke: theme.colors.border.medium,
    strokeWidth: 1.5,
  }),
  flow: css({
    fill: 'none',
    stroke: theme.colors.text.link,
    strokeWidth: 2,
    strokeDasharray: '5 9',
    strokeLinecap: 'round',
    opacity: 0.9,
    [theme.transitions.handleMotion('no-preference')]: {
      animation: `${flowAnimation} 0.9s linear infinite`,
    },
  }),
});
