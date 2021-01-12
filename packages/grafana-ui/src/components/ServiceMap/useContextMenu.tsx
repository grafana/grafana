import React, { MouseEvent, useCallback, useState } from 'react';
import { LinkDatum, NodeDatum } from './types';
import { DataFrame, Field, GrafanaTheme, LinkModel } from '@grafana/data';
import { ContextMenu } from '../ContextMenu/ContextMenu';
import { useTheme } from '../../themes/ThemeContext';
import { stylesFactory } from '../../themes/stylesFactory';
import { getNodeFields } from './utils';
import { css } from 'emotion';

/**
 * Hook that contains state of the context menu, both for edges and nodes and provides appropriate component when
 * opened context menu should be opened.
 */
export function useContextMenu(
  getLinks: (dataFrame: DataFrame, rowIndex: number) => LinkModel[],
  nodes: DataFrame,
  edges: DataFrame
): {
  onEdgeOpen: (event: MouseEvent<SVGElement>, edge: LinkDatum) => void;
  onNodeOpen: (event: MouseEvent<SVGElement>, node: NodeDatum) => void;
  MenuComponent: React.ReactNode;
} {
  function getItems(dataFrame: DataFrame, rowIndex: number) {
    return [
      {
        label: 'Open in Explore',
        items: getLinks(dataFrame, rowIndex).map(l => ({
          label: l.title,
          url: l.href,
          onClick: l.onClick,
        })),
      },
    ];
  }

  const [openedNode, setOpenedNode] = useState<{ node: NodeDatum; event: MouseEvent } | undefined>(undefined);
  const onNodeOpen = useCallback((event, node) => setOpenedNode({ node, event }), []);

  const [openedEdge, setOpenedEdge] = useState<{ edge: LinkDatum; event: MouseEvent } | undefined>(undefined);
  const onEdgeOpen = useCallback((event, edge) => setOpenedEdge({ edge, event }), []);

  let MenuComponent = null;

  if (openedNode) {
    MenuComponent = (
      <ContextMenu
        renderHeader={() => <NodeHeader node={openedNode.node} nodes={nodes} />}
        items={getItems(nodes, openedNode.node.dataFrameRowIndex)}
        onClose={() => setOpenedNode(undefined)}
        x={openedNode.event.pageX}
        y={openedNode.event.pageY}
      />
    );
  }

  if (openedEdge) {
    MenuComponent = (
      <ContextMenu
        items={getItems(edges, openedEdge.edge.dataFrameRowIndex)}
        onClose={() => setOpenedEdge(undefined)}
        x={openedEdge.event.pageX}
        y={openedEdge.event.pageY}
      />
    );
  }

  return { onEdgeOpen, onNodeOpen, MenuComponent };
}

function NodeHeader(props: { node: NodeDatum; nodes: DataFrame }) {
  const index = props.node.dataFrameRowIndex;
  const fields = getNodeFields(props.nodes);
  return (
    <div>
      <Label field={fields.title} index={index} />
      <Label field={fields.subTitle} index={index} />
    </div>
  );
}

export const getLabelStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    label: css`
      label: Label;
      line-height: 1.25;
      margin: ${theme.spacing.formLabelMargin};
      padding: ${theme.spacing.formLabelPadding};
      color: ${theme.colors.textFaint};
      font-size: ${theme.typography.size.sm};
      font-weight: ${theme.typography.weight.semibold};
    `,
    value: css`
      label: Value;
      font-size: ${theme.typography.size.sm};
      font-weight: ${theme.typography.weight.semibold};
      color: ${theme.colors.formLabel};
      margin-top: ${theme.spacing.xxs};
      display: block;
    `,
  };
});
function Label(props: { field: Field; index: number }) {
  const { field, index } = props;
  const value = field.values.get(index);
  const styles = getLabelStyles(useTheme());

  return (
    <div className={styles.label}>
      <div>{field.config.displayName || field.name}</div>
      <span className={styles.value}>{value}</span>
    </div>
  );
}
