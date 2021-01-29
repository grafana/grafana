import React, { MouseEvent, useCallback, useState } from 'react';
import { EdgeDatum, NodeDatum } from './types';
import { DataFrame, Field, GrafanaTheme, LinkModel } from '@grafana/data';
import { ContextMenu } from '../ContextMenu/ContextMenu';
import { useTheme } from '../../themes/ThemeContext';
import { stylesFactory } from '../../themes/stylesFactory';
import { getEdgeFields, getNodeFields } from './utils';
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
  onEdgeOpen: (event: MouseEvent<SVGElement>, edge: EdgeDatum) => void;
  onNodeOpen: (event: MouseEvent<SVGElement>, node: NodeDatum) => void;
  MenuComponent: React.ReactNode;
} {
  const [openedNode, setOpenedNode] = useState<{ node: NodeDatum; event: MouseEvent } | undefined>(undefined);
  const onNodeOpen = useCallback((event, node) => setOpenedNode({ node, event }), []);

  const [openedEdge, setOpenedEdge] = useState<{ edge: EdgeDatum; event: MouseEvent } | undefined>(undefined);
  const onEdgeOpen = useCallback((event, edge) => setOpenedEdge({ edge, event }), []);

  let MenuComponent = null;

  if (openedNode) {
    const items = getItems(getLinks(nodes, openedNode.node.dataFrameRowIndex));
    if (items.length) {
      MenuComponent = (
        <ContextMenu
          renderHeader={() => <NodeHeader node={openedNode.node} nodes={nodes} />}
          items={items}
          onClose={() => setOpenedNode(undefined)}
          x={openedNode.event.pageX}
          y={openedNode.event.pageY}
        />
      );
    }
  }

  if (openedEdge) {
    const items = getItems(getLinks(edges, openedEdge.edge.dataFrameRowIndex));
    if (items.length) {
      MenuComponent = (
        <ContextMenu
          renderHeader={() => <EdgeHeader edge={openedEdge.edge} edges={edges} />}
          items={items}
          onClose={() => setOpenedEdge(undefined)}
          x={openedEdge.event.pageX}
          y={openedEdge.event.pageY}
        />
      );
    }
  }

  return { onEdgeOpen, onNodeOpen, MenuComponent };
}

function getItems(links: LinkModel[]) {
  const defaultGroup = 'Open in Explore';
  const groups = links.reduce<{ [group: string]: Array<{ l: LinkModel; newTitle?: string }> }>((acc, l) => {
    let group;
    let title;
    if (l.title.indexOf('/') !== -1) {
      group = l.title.split('/')[0];
      title = l.title.split('/')[1];
      acc[group] = acc[group] || [];
      acc[group].push({ l, newTitle: title });
    } else {
      acc[defaultGroup] = acc[defaultGroup] || [];
      acc[defaultGroup].push({ l });
    }

    return acc;
  }, {});

  return Object.keys(groups).map((key) => {
    return {
      label: key,
      items: groups[key].map((link) => ({
        label: link.newTitle || link.l.title,
        url: link.l.href,
        onClick: link.l.onClick,
      })),
    };
  });
}

function NodeHeader(props: { node: NodeDatum; nodes: DataFrame }) {
  const index = props.node.dataFrameRowIndex;
  const fields = getNodeFields(props.nodes);
  return (
    <div>
      {fields.title && <Label field={fields.title} index={index} />}
      {fields.subTitle && <Label field={fields.subTitle} index={index} />}
      {fields.details.map((f) => (
        <Label key={f.name} field={f} index={index} />
      ))}
    </div>
  );
}

function EdgeHeader(props: { edge: EdgeDatum; edges: DataFrame }) {
  const index = props.edge.dataFrameRowIndex;
  const fields = getEdgeFields(props.edges);
  return (
    <div>
      {fields.details.map((f) => (
        <Label key={f.name} field={f} index={index} />
      ))}
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
  const value = field.values.get(index) || '';
  const styles = getLabelStyles(useTheme());

  return (
    <div className={styles.label}>
      <div>{field.config.displayName || field.name}</div>
      <span className={styles.value}>{value}</span>
    </div>
  );
}
