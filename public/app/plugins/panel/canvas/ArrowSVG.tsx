import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

type Props = {
  setSVGRef: (anchorElement: SVGSVGElement) => void;
  setLineRef: (anchorElement: SVGLineElement) => void;
};

export const ArrowSVG = ({ setSVGRef, setLineRef }: Props) => {
  const styles = useStyles2(getStyles);

  return (
    <svg ref={setSVGRef} className={styles.arrowSVG}>
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="0"
          refY="3.5"
          orient="auto"
          stroke="rgb(255,255,255)"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="rgb(255,255,255)" />
        </marker>
      </defs>
      <line ref={setLineRef} style={{ stroke: 'rgb(255,255,255)', strokeWidth: 2 }} markerEnd="url(#arrowhead)" />
    </svg>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  arrowSVG: css`
    position: absolute;
    pointer-events: none;
    width: 100%;
    height: 100%;
    display: none;
  `,
});
