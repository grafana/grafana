import { css } from '@emotion/css';
import { MouseEvent, useCallback, useState } from 'react';
import * as React from 'react';

import { DataFrame, Field, GrafanaTheme2, LinkModel, LinkTarget } from '@grafana/data';
import { ContextMenu, MenuGroup, MenuItem, useStyles2 } from '@grafana/ui';

import { Config } from './layout';
import { EdgeDatumLayout, NodeDatum } from './types';
import { getEdgeFields, getNodeFields, statToString } from './utils';

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
  onEdgeOpen: (event: MouseEvent<SVGElement>, edge: EdgeDatumLayout) => void;
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
      setMenu(makeContextMenu(<NodeHeader node={node} nodes={nodes} />, event, setMenu, renderer));
    },
    [config, nodes, getLinks, setMenu, setConfig, setFocusedNodeId]
  );

  const onEdgeOpen = useCallback(
    (event: MouseEvent<SVGElement>, edge: EdgeDatumLayout) => {
      if (!edges) {
        // This could happen if we have only one node and no edges, in which case this is not needed as there is no edge
        // to click on.
        return;
      }
      const links = getLinks(edges, edge.dataFrameRowIndex);
      const renderer = getItemsRenderer(links, edge);
      setMenu(makeContextMenu(<EdgeHeader edge={edge} edges={edges} />, event, setMenu, renderer));
    },
    [edges, getLinks, setMenu]
  );

  return { onEdgeOpen, onNodeOpen, MenuComponent: menu };
}

function makeContextMenu(
  header: JSX.Element,
  event: MouseEvent<SVGElement>,
  setMenu: (el: JSX.Element | undefined) => void,
  renderer?: () => React.ReactNode
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

function getItemsRenderer<T extends NodeDatum | EdgeDatumLayout>(
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

function mapMenuItem<T extends NodeDatum | EdgeDatumLayout>(item: T) {
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
        target={link.target || '_self'}
      />
    );
  };
}

type LinkData<T extends NodeDatum | EdgeDatumLayout> = {
  label: string;
  ariaLabel?: string;
  url?: string;
  onClick?: (item: T) => void;
  target?: LinkTarget;
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
        target: link.l.target,
      })),
    };
  });
}

function FieldRow({ field, index }: { field: Field; index: number }) {
  return (
    <HeaderRow
      label={field.config?.displayName || field.name}
      value={statToString(field.config, field.values[index] || '')}
    />
  );
}

function HeaderRow({ label, value }: { label: string; value: string }) {
  const styles = useStyles2(getLabelStyles);
  return (
    <tr>
      <td className={styles.label}>{label}: </td>
      <td className={styles.value}>{value}</td>
    </tr>
  );
}

/**
 * Shows some field values in a table on top of the context menu.
 */
function NodeHeader({ node, nodes }: { node: NodeDatum; nodes?: DataFrame }) {
  const rows = [];
  if (nodes) {
    const fields = getNodeFields(nodes);
    for (const f of [fields.title, fields.subTitle, fields.mainStat, fields.secondaryStat, ...fields.details]) {
      if (f && f.values[node.dataFrameRowIndex]) {
        rows.push(<FieldRow key={f.name} field={f} index={node.dataFrameRowIndex} />);
      }
    }
  } else {
    // Fallback if we don't have nodes dataFrame. Can happen if we use just the edges frame to construct this.
    if (node.title) {
      rows.push(<HeaderRow key="title" label={'Title'} value={node.title} />);
    }
    if (node.subTitle) {
      rows.push(<HeaderRow key="subtitle" label={'Subtitle'} value={node.subTitle} />);
    }
  }

  return (
    <table style={{ width: '100%' }}>
      <tbody>{rows}</tbody>
    </table>
  );
}

/**
 * Shows some of the field values in a table on top of the context menu.
 */
function EdgeHeader(props: { edge: EdgeDatumLayout; edges: DataFrame }) {
  const index = props.edge.dataFrameRowIndex;
  const fields = getEdgeFields(props.edges);
  const valueSource = fields.source?.values[index] || '';
  const valueTarget = fields.target?.values[index] || '';

  const rows = [];
  if (valueSource && valueTarget) {
    rows.push(<HeaderRow key={'header-row'} label={'Source → Target'} value={`${valueSource} → ${valueTarget}`} />);
  }

  for (const f of [fields.mainStat, fields.secondaryStat, ...fields.details]) {
    if (f && f.values[index]) {
      rows.push(<FieldRow key={`field-row-${index}`} field={f} index={index} />);
    }
  }

  return (
    <table style={{ width: '100%' }}>
      <tbody>{rows}</tbody>
    </table>
  );
}

export const getLabelStyles = (theme: GrafanaTheme2) => {
  return {
    label: css({
      label: 'Label',
      lineHeight: 1.25,
      color: theme.colors.text.disabled,
      fontSize: theme.typography.size.sm,
      fontWeight: theme.typography.fontWeightMedium,
      paddingRight: theme.spacing(1),
    }),
    value: css({
      label: 'Value',
      fontSize: theme.typography.size.sm,
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.text.primary,
    }),
  };
};
