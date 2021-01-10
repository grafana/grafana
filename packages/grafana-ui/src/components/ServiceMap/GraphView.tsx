import React, { MouseEvent, MutableRefObject, useCallback, useMemo, useState } from 'react';
import useMeasure from 'react-use/lib/useMeasure';
import { usePanning } from './usePanning';
import { LinkDatum, NodeDatum } from './types';
import { Node } from './Node';
import { Link } from './Link';
import { ViewControls } from './ViewControls';
import { DataFrame, Field, FieldCache, FieldType, GrafanaTheme, LinkModel } from '@grafana/data';
import { useZoom } from './useZoom';
import { Bounds, Config, defaultConfig, useLayout } from './layout';
import { LinkArrowMarker } from './LinkArrowMarker';
import { stylesFactory, useTheme } from '../../themes';
import { css } from 'emotion';
import { useCategorizeFrames } from './useCategorizeFrames';
import { ContextMenu } from '..';

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  wrapper: css`
    height: 100%;
    width: 100%;
    overflow: hidden;
    position: relative;
  `,

  svg: css`
    height: 100%;
    width: 100%;
    overflow: visible;
    font-size: 10px;
  `,

  viewControls: css`
    position: absolute;
    left: 10px;
    top: 10px;
  `,
}));

interface Props {
  dataFrames: DataFrame[];
  getLinks: (dataFrame: DataFrame, rowIndex: number) => LinkModel[];
}
export function GraphView({ getLinks, dataFrames }: Props) {
  const { edges: edgesDataFrames, nodes: nodesDataFrames } = useCategorizeFrames(dataFrames);

  const [measureRef, { width, height }] = useMeasure();
  const [config, setConfig] = useState<Config>(defaultConfig);

  // We need nodeHover here because if we hover node we also highlight it's edges, while hovering over the edge
  // highlights just the edge
  const [nodeHover, setNodeHover] = useState<string | undefined>(undefined);
  const clearNodeHover = useCallback(() => setNodeHover(undefined), []);

  // TODO we should be able to allow multiple dataframes for both edges and nodes, could be ussue with node ids which in
  //  that case should be unique or figure a way to link edges and nodes dataframes together.
  const { nodes: rawNodes, links: rawLinks } = useMemo(() => processServices(nodesDataFrames[0], edgesDataFrames[0]), [
    nodesDataFrames[0],
    edgesDataFrames[0],
  ]);
  const { nodes, edges, bounds } = useLayout(rawNodes, rawLinks, config);
  const { panRef, zoomRef, onStepUp, onStepDown, isPanning, position, scale } = usePanAndZoom(bounds);
  const { onEdgeOpen, onNodeOpen, MenuComponent } = useContextMenu(getLinks, nodesDataFrames[0], edgesDataFrames[0]);
  const styles = getStyles(useTheme());

  return (
    <div
      ref={r => {
        measureRef(r);
        (zoomRef as MutableRefObject<HTMLElement | null>).current = r;
      }}
      className={styles.wrapper}
    >
      <svg
        ref={panRef}
        viewBox={`${-(width / 2)} ${-(height / 2)} ${width} ${height}`}
        className={styles.svg}
        style={{ userSelect: isPanning ? 'none' : 'unset' }}
      >
        <g style={{ transform: `scale(${scale}) translate(${position.x}px, ${position.y}px)` }}>
          <LinkArrowMarker />
          {edges.map((e, index) => (
            <Link
              key={index}
              link={e}
              showStats={(e.source as NodeDatum).id === nodeHover || (e.target as NodeDatum).id === nodeHover}
              onClick={onEdgeOpen}
            />
          ))}
          {nodes.map(n => (
            <Node key={n.id} node={n} onMouseEnter={setNodeHover} onMouseLeave={clearNodeHover} onClick={onNodeOpen} />
          ))}
        </g>
      </svg>

      <div className={styles.viewControls}>
        <ViewControls<Config> config={config} onConfigChange={setConfig} onMinus={onStepDown} onPlus={onStepUp} />
      </div>

      {MenuComponent}
    </div>
  );
}

/**
 * Hook that contains state of the context menu, both for edges and nodes and provides appropriate component when
 * opened context menu should be opened.
 */
function useContextMenu(
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
        renderHeader={() => <div>{openedNode.node.title}</div>}
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
        renderHeader={() => (
          <div>
            {(openedEdge.edge.source as NodeDatum).title} {'->'} {(openedEdge.edge.target as NodeDatum).title}
          </div>
        )}
        items={getItems(edges, openedEdge.edge.dataFrameRowIndex)}
        onClose={() => setOpenedEdge(undefined)}
        x={openedEdge.event.pageX}
        y={openedEdge.event.pageY}
      />
    );
  }

  return { onEdgeOpen, onNodeOpen, MenuComponent };
}

function usePanAndZoom(bounds: Bounds) {
  const { scale, onStepDown, onStepUp, ref } = useZoom();
  const { state: panningState, ref: panRef } = usePanning<SVGSVGElement>({
    scale,
    bounds,
  });
  const { position, isPanning } = panningState;
  return { zoomRef: ref, panRef, position, isPanning, scale, onStepDown, onStepUp };
}

/**
 * Transform nodes and edges dataframes into array of objects that the layout code can then work with.
 */
function processServices(nodes: DataFrame, edges: DataFrame): { nodes: NodeDatum[]; links: LinkDatum[] } {
  const nodesFieldsCache = new FieldCache(nodes);
  const idField = nodesFieldsCache.getFieldByName('id');
  const titleField = nodesFieldsCache.getFieldsByLabel(labelType, titleLabel)[0];
  const subTitleField = nodesFieldsCache.getFieldsByLabel(labelType, subTitleLabel)[0];
  const mainStatField = nodesFieldsCache.getFieldsByLabel(labelType, mainStat)[0];
  const secondaryStatField = nodesFieldsCache.getFieldsByLabel(labelType, secondaryStat)[0];
  const arcFields = nodesFieldsCache.getFieldsByLabel(labelType, arcLabel);

  const servicesMap =
    idField?.values.toArray().reduce<{ [id: string]: NodeDatum }>((acc, id, index) => {
      acc[id] = {
        id: id,
        title: titleField.values.get(index),
        subTitle: subTitleField.values.get(index),
        dataFrameRowIndex: index,
        incoming: 0,
        mainStat: statToString(mainStatField, index),
        secondaryStat: statToString(secondaryStatField, index),
        arcSections: arcFields.map(f => {
          return {
            value: f.values.get(index),
            color: f.config.color?.fixedColor || '',
          };
        }),
      };
      return acc;
    }, {}) || {};

  const edgesFieldsCache = new FieldCache(edges);
  const edgeSourceField = edgesFieldsCache.getFieldByName('source');
  const edgeTargetField = edgesFieldsCache.getFieldByName('target');
  const edgeMainStatField = edgesFieldsCache.getFieldsByLabel(labelType, mainStat)[0];
  const edgeSecondaryStatField = edgesFieldsCache.getFieldsByLabel(labelType, secondaryStat)[0];
  const edgesMapped = edgeSourceField?.values.toArray().map((source, index) => {
    const target = edgeTargetField?.values.get(index);
    // We are adding incoming edges count so we can later on find out which nodes are the roots
    servicesMap[target].incoming++;

    return {
      dataFrameRowIndex: index,
      source,
      target,
      mainStat: statToString(edgeMainStatField, index),
      secondaryStat: statToString(edgeSecondaryStatField, index),
    } as LinkDatum;
  });

  return {
    nodes: Object.values(servicesMap),
    links: edgesMapped || [],
  };
}

function statToString(field: Field, index: number) {
  if (field.type === FieldType.string) {
    return field.values.get(index);
  } else {
    const decimals = field.config.decimals || 2;
    const val = field.values.get(index);
    if (Number.isFinite(val)) {
      return field.values.get(index).toFixed(decimals) + ' ' + field.config.unit;
    } else {
      return '';
    }
  }
}

// TODO move to grafana data probably
const labelType = 'NodeGraphValueType';
const arcLabel = 'arc';
const titleLabel = 'title';
const subTitleLabel = 'subTitle';
const mainStat = 'mainStat';
const secondaryStat = 'secondaryStat';
