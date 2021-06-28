import React, { MouseEvent, memo } from 'react';
import { NodesMarker } from './types';
import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';
import { stylesFactory, useTheme } from '@grafana/ui';

const nodeR = 40;

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  mainGroup: css`
    cursor: pointer;
    font-size: 10px;
  `,

  mainCircle: css`
    fill: ${theme.colors.panelBg};
    stroke: ${theme.colors.border3};
  `,
  text: css`
    width: 50px;
    height: 50px;
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
  `,
}));

export const Marker = memo(function Marker(props: {
  marker: NodesMarker;
  onClick?: (event: MouseEvent<SVGElement>, marker: NodesMarker) => void;
}) {
  const { marker, onClick } = props;
  const { node } = marker;
  const styles = getStyles(useTheme());

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
