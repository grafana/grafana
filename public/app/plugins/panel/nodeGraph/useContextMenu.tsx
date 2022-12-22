import { css } from '@emotion/css';
import React, { MouseEvent, useCallback, useState } from 'react';

import { DataFrame, GrafanaTheme2, LinkModel } from '@grafana/data';
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
  // This can be undefined if we only use edge dataframe
  nodes: DataFrame | undefined,
  // This can be undefined if we have only single node
  edges: DataFrame | undefined,
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
      const [label, showGridLayout] = config.gridLayout
        ? ['Show in Graph layout', false]
        : ['Show in Grid layout', true];

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

      const links = nodes ? getLinks(nodes, node.dataFrameRowIndex) : [];
      const renderer = getItemsRenderer(links, node, extraNodeItem);

      if (renderer) {
        setMenu(makeContextMenu(<NodeHeader node={node} nodes={nodes} />, renderer, event, setMenu));
      }
    },
    [config, nodes, getLinks, setMenu, setConfig, setFocusedNodeId]
  );

  const onEdgeOpen = useCallback(
    (event: MouseEvent<SVGElement>, edge: EdgeDatum) => {
      if (!edges) {
        // This could happen if we have only one node and no edges, in which case this is not needed as there is no edge
        // to click on.
        return;
      }
      const links = getLinks(edges, edge.dataFrameRowIndex);
      const renderer = getItemsRenderer(links, edge);

      if (renderer) {
        setMenu(makeContextMenu(<EdgeHeader edge={edge} edges={edges} />, renderer, event, setMenu));
      }
    },
    [edges, getLinks, setMenu]
  );

  return { onEdgeOpen, onNodeOpen, MenuComponent: menu };
}

function makeContextMenu(
  header: JSX.Element,
  renderer: () => React.ReactNode,
  event: MouseEvent<SVGElement>,
  setMenu: (el: JSX.Element | undefined) => void
) {
  return (
    <ContextMenu
      renderHeader={() => header}
      renderMenuItems={renderer}
      onClose={() => setMenu(undefined)}
      x={event.pageX}
      y={event.pageY}
    />
  );
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

function NodeHeader({ node, nodes }: { node: NodeDatum; nodes?: DataFrame }) {
  const index = node.dataFrameRowIndex;
  if (nodes) {
    const fields = getNodeFields(nodes);

    return (
      <div>
        {fields.title && (
          <Label
            label={fields.title.config.displayName || fields.title.name}
            value={fields.title.values.get(index) || ''}
          />
        )}
        {fields.subTitle && (
          <Label
            label={fields.subTitle.config.displayName || fields.subTitle.name}
            value={fields.subTitle.values.get(index) || ''}
          />
        )}
        {fields.details.map((f) => (
          <Label key={f.name} label={f.config.displayName || f.name} value={f.values.get(index) || ''} />
        ))}
      </div>
    );
  } else {
    // Fallback if we don't have nodes dataFrame. Can happen if we use just the edges frame to construct this.
    return (
      <div>
        {node.title && <Label label={'Title'} value={node.title} />}
        {node.subTitle && <Label label={'Subtitle'} value={node.subTitle} />}
      </div>
    );
  }
}

function EdgeHeader(props: { edge: EdgeDatum; edges: DataFrame }) {
  const index = props.edge.dataFrameRowIndex;
  const styles = getLabelStyles(useTheme2());
  const fields = getEdgeFields(props.edges);
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
        <Label key={f.name} label={f.config.displayName || f.name} value={f.values.get(index) || ''} />
      ))}
    </div>
  );
}

function Label({ label, value }: { label: string; value: string | number }) {
  const styles = useStyles2(getLabelStyles);

  return (
    <div className={styles.label}>
      <div>{label}</div>
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
