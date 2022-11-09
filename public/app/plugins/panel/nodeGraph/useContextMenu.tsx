import { css } from '@emotion/css';
import React, { MouseEvent, useCallback, useState } from 'react';

import { DataFrame, Field, GrafanaTheme2, LinkModel } from '@grafana/data';
import { ContextMenu, MenuGroup, MenuItem, useStyles2, useTheme2 } from '@grafana/ui';

import { Config } from './layout';
import { EdgeDatum, NodeDatum } from './types';
import { getEdgeFields, getNodeFields } from './utils';

/**
 * Hook that contains state of the context menu, both for edges and nodes and provides appropriate component when
 * opened context menu should be opened.
 */
export function useContextMenu(
  getLinks: (dataFrame: DataFrame, rowIndex: number) => LinkModel[],
  nodes: DataFrame,
  edges: DataFrame,
  config: Config,
  setConfig: (config: Config) => void,
  setFocusedNodeId: (id: string) => void
): {
  onEdgeOpen: (event: MouseEvent<SVGElement>, edge: EdgeDatum) => void;
  onNodeOpen: (event: MouseEvent<SVGElement>, node: NodeDatum) => void;
  MenuComponent: React.ReactNode;
} {
  const [menu, setMenu] = useState<JSX.Element | undefined>(undefined);

  const onNodeOpen = useCallback(
    (event: MouseEvent<SVGElement>, node: NodeDatum) => {
      let label = 'Show in Grid layout';
      let showGridLayout = true;

      if (config.gridLayout) {
        label = 'Show in Graph layout';
        showGridLayout = false;
      }

      const extraNodeItem = [
        {
          label: label,
          onClick: (node: NodeDatum) => {
            setFocusedNodeId(node.id);
            setConfig({ ...config, gridLayout: showGridLayout });
            setMenu(undefined);
          },
        },
      ];

      const renderer = getItemsRenderer(getLinks(nodes, node.dataFrameRowIndex), node, extraNodeItem);

      if (renderer) {
        setMenu(
          <ContextMenu
            renderHeader={() => <NodeHeader node={node} nodes={nodes} />}
            renderMenuItems={renderer}
            onClose={() => setMenu(undefined)}
            x={event.pageX}
            y={event.pageY}
          />
        );
      }
    },
    [config, nodes, getLinks, setMenu, setConfig, setFocusedNodeId]
  );

  const onEdgeOpen = useCallback(
    (event: MouseEvent<SVGElement>, edge: EdgeDatum) => {
      const renderer = getItemsRenderer(getLinks(edges, edge.dataFrameRowIndex), edge);

      if (renderer) {
        setMenu(
          <ContextMenu
            renderHeader={() => <EdgeHeader edge={edge} edges={edges} />}
            renderMenuItems={renderer}
            onClose={() => setMenu(undefined)}
            x={event.pageX}
            y={event.pageY}
          />
        );
      }
    },
    [edges, getLinks, setMenu]
  );

  return { onEdgeOpen, onNodeOpen, MenuComponent: menu };
}

function getItemsRenderer<T extends NodeDatum | EdgeDatum>(
  links: LinkModel[],
  item: T,
  extraItems?: Array<LinkData<T>> | undefined
) {
  if (!(links.length || extraItems?.length)) {
    return undefined;
  }
  const items = getItems(links);
  return () => {
    let groups = items?.map((group, index) => (
      <MenuGroup key={`${group.label}${index}`} label={group.label}>
        {(group.items || []).map(mapMenuItem(item))}
      </MenuGroup>
    ));

    if (extraItems) {
      groups = [...extraItems.map(mapMenuItem(item)), ...groups];
    }
    return groups;
  };
}

function mapMenuItem<T extends NodeDatum | EdgeDatum>(item: T) {
  return function NodeGraphMenuItem(link: LinkData<T>) {
    return (
      <MenuItem
        key={link.label}
        url={link.url}
        label={link.label}
        ariaLabel={link.ariaLabel}
        onClick={
          link.onClick
            ? (event) => {
                if (!(event?.ctrlKey || event?.metaKey || event?.shiftKey)) {
                  event?.preventDefault();
                  event?.stopPropagation();
                  link.onClick?.(item);
                }
              }
            : undefined
        }
        target={'_self'}
      />
    );
  };
}

type LinkData<T extends NodeDatum | EdgeDatum> = {
  label: string;
  ariaLabel?: string;
  url?: string;
  onClick?: (item: T) => void;
};

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
      ariaLabel: key,
      items: groups[key].map((link) => ({
        label: link.newTitle || link.l.title,
        ariaLabel: link.newTitle || link.l.title,
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
  const styles = getLabelStyles(useTheme2());
  const valueSource = fields.source?.values.get(index) || '';
  const valueTarget = fields.target?.values.get(index) || '';

  return (
    <div>
      {fields.source && fields.target && (
        <div className={styles.label}>
          <div>Source → Target</div>
          <span className={styles.value}>
            {valueSource} → {valueTarget}
          </span>
        </div>
      )}
      {fields.details.map((f) => (
        <Label key={f.name} field={f} index={index} />
      ))}
    </div>
  );
}

function Label(props: { field: Field; index: number }) {
  const { field, index } = props;
  const value = field.values.get(index) || '';
  const styles = useStyles2(getLabelStyles);

  return (
    <div className={styles.label}>
      <div>{field.config.displayName || field.name}</div>
      <span className={styles.value}>{value}</span>
    </div>
  );
}

export const getLabelStyles = (theme: GrafanaTheme2) => {
  return {
    label: css`
      label: Label;
      line-height: 1.25;
      margin-bottom: ${theme.spacing(0.5)};
      padding-left: ${theme.spacing(0.25)};
      color: ${theme.colors.text.disabled};
      font-size: ${theme.typography.size.sm};
      font-weight: ${theme.typography.fontWeightMedium};
    `,
    value: css`
      label: Value;
      font-size: ${theme.typography.size.sm};
      font-weight: ${theme.typography.fontWeightMedium};
      color: ${theme.colors.text.primary};
      margin-top: ${theme.spacing(0.25)};
      display: block;
    `,
  };
};
