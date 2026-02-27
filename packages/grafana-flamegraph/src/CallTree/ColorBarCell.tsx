import { GrafanaTheme2 } from '@grafana/data';

import { FlameGraphDataContainer } from '../FlameGraph/dataTransform';
import { ColorScheme, ColorSchemeDiff } from '../types';

import { Styles } from './styles';
import { CallTreeNode, getRowBarColor } from './utils';

export function ColorBarCell({
  node,
  data,
  colorScheme,
  theme,
  styles,
  focusedNode,
}: {
  node: CallTreeNode;
  data: FlameGraphDataContainer;
  colorScheme: ColorScheme | ColorSchemeDiff;
  theme: GrafanaTheme2;
  styles: Styles;
  focusedNode?: CallTreeNode;
}) {
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
