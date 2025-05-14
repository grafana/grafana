import { css } from '@emotion/css';
import { MouseEvent, memo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { NodesMarker } from './types';

const nodeR = 40;

const getStyles = (theme: GrafanaTheme2) => ({
  mainGroup: css({
    cursor: 'pointer',
    fontSize: '10px',
  }),

  mainCircle: css({
    fill: theme.components.panel.background,
    stroke: theme.colors.border.strong,
  }),
  text: css({
    width: '50px',
    height: '50px',
    textAlign: 'center',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }),
});

export const Marker = memo(function Marker(props: {
  marker: NodesMarker;
  onClick?: (event: MouseEvent<SVGElement>, marker: NodesMarker) => void;
}) {
  const { marker, onClick } = props;
  const { node } = marker;
  const styles = useStyles2(getStyles);

  if (!(node.x !== undefined && node.y !== undefined)) {
    return null;
  }

  return (
    <g
      data-node-id={node.id}
      className={styles.mainGroup}
      onClick={(event) => {
        onClick?.(event, marker);
      }}
      aria-label={`Hidden nodes marker: ${node.id}`}
    >
      <circle className={styles.mainCircle} r={nodeR} cx={node.x} cy={node.y} />
      <g>
        <foreignObject x={node.x - 25} y={node.y - 25} width="50" height="50">
          <div className={styles.text}>
            {/* we limit the count to 101 so if we have more than 100 nodes we don't have exact count */}
            <span>{marker.count > 100 ? '>100' : marker.count} nodes</span>
          </div>
        </foreignObject>
      </g>
    </g>
  );
});
