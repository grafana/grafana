import React, { memo } from 'react';
import { EdgeDatum, NodeDatum } from './types';
import { css } from 'emotion';
import { stylesFactory, useTheme } from '../../themes';
import { GrafanaTheme } from '@grafana/data';
import tinycolor from 'tinycolor2';
import lightTheme from '../../themes/light';
import darkTheme from '../../themes/dark';
import { shortenLine } from './utils';

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const inverseTheme = theme.isDark ? lightTheme : darkTheme;
  return {
    mainGroup: css`
      pointer-events: none;
      font-size: 8px;
    `,

    background: css`
      fill: ${tinycolor(inverseTheme.colors.bodyBg).setAlpha(0.8).toHex8String()};
    `,

    text: css`
      fill: ${inverseTheme.colors.text};
    `,
  };
});

interface Props {
  edge: EdgeDatum;
}
export const EdgeLabel = memo(function EdgeLabel(props: Props) {
  const { edge } = props;
  // Not great typing but after we do layout these properties are full objects not just references
  const { source, target } = edge as { source: NodeDatum; target: NodeDatum };

  // As the nodes have some radius we want edges to end outside of the node circle.
  const line = shortenLine(
    {
      x1: source.x!,
      y1: source.y!,
      x2: target.x!,
      y2: target.y!,
    },
    90
  );

  const middle = {
    x: line.x1 + (line.x2 - line.x1) / 2,
    y: line.y1 + (line.y2 - line.y1) / 2,
  };
  const styles = getStyles(useTheme());

  return (
    <g className={styles.mainGroup}>
      <rect className={styles.background} x={middle.x - 40} y={middle.y - 15} width="80" height="30" rx="5" />
      <text className={styles.text} x={middle.x} y={middle.y - 5} textAnchor={'middle'}>
        {edge.mainStat}
      </text>
      <text className={styles.text} x={middle.x} y={middle.y + 10} textAnchor={'middle'}>
        {edge.secondaryStat}
      </text>
    </g>
  );
});
