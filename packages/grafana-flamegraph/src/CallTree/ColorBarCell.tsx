import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { type FlameGraphDataContainer } from '../FlameGraph/dataTransform';
import { type ColorScheme, type ColorSchemeDiff } from '../types';

import { type CallTreeNode, getRowBarColor } from './utils';

export function ColorBarCell({
  node,
  data,
  colorScheme,
  theme,
  focusedNode,
}: {
  node: CallTreeNode;
  data: FlameGraphDataContainer;
  colorScheme: ColorScheme | ColorSchemeDiff;
  theme: GrafanaTheme2;
  focusedNode?: CallTreeNode;
}) {
  const styles = useStyles2(getStyles);
  const barColor = getRowBarColor(node, data, colorScheme, theme);

  let barWidth: string;

  if (focusedNode) {
    if (node.id === focusedNode.parentId) {
      barWidth = '0%';
    } else {
      const relativePercent = focusedNode.total > 0 ? (node.total / focusedNode.total) * 100 : 0;
      barWidth = `${Math.min(relativePercent, 100)}%`;
    }
  } else {
    barWidth = `${Math.min(node.totalPercent, 100)}%`;
  }

  return (
    <div className={styles.colorBarContainer}>
      <div className={styles.colorBar} style={{ width: barWidth, backgroundColor: barColor }} />
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    colorBarContainer: css({
      width: '100%',
      height: '20px',
      display: 'flex',
      alignItems: 'center',
    }),
    colorBar: css({
      height: '16px',
      minWidth: '2px',
      borderRadius: theme.shape.radius.default,
    }),
  };
}
