import React, { MutableRefObject, useCallback, useMemo, useState } from 'react';
import useMeasure from 'react-use/lib/useMeasure';
import { usePanning } from './usePanning';
import { EdgeDatum, NodeDatum } from './types';
import { Node } from './Node';
import { Edge } from './Edge';
import { ViewControls } from './ViewControls';
import { DataFrame, Field, FieldType, GrafanaTheme, LinkModel } from '@grafana/data';
import { useZoom } from './useZoom';
import { Bounds, Config, defaultConfig, useLayout } from './layout';
import { EdgeArrowMarker } from './EdgeArrowMarker';
import { stylesFactory, useTheme } from '../../themes';
import { css } from 'emotion';
import { useCategorizeFrames } from './useCategorizeFrames';
import { EdgeLabel } from './EdgeLabel';
import { useContextMenu } from './useContextMenu';
import { getEdgeFields, getNodeFields } from './utils';

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
    cursor: move;
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
export function NodeGraph({ getLinks, dataFrames }: Props) {
  const { edges: edgesDataFrames, nodes: nodesDataFrames } = useCategorizeFrames(dataFrames);

  const [measureRef, { width, height }] = useMeasure();
  const [config, setConfig] = useState<Config>(defaultConfig);

  // We need hover state here because for nodes we also highlight edges and for edges have labels separate to make
  // sure they are visible on top of everything else
  const [nodeHover, setNodeHover] = useState<string | undefined>(undefined);
  const clearNodeHover = useCallback(() => setNodeHover(undefined), []);
  const [edgeHover, setEdgeHover] = useState<string | undefined>(undefined);
  const clearEdgeHover = useCallback(() => setEdgeHover(undefined), []);

  // TODO we should be able to allow multiple dataframes for both edges and nodes, could be issue with node ids which in
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
          <EdgeArrowMarker />
          {edges.map((e, index) => (
            <Edge
              key={e.id}
              edge={e}
              hovering={
                (e.source as NodeDatum).id === nodeHover ||
                (e.target as NodeDatum).id === nodeHover ||
                edgeHover === e.id
              }
              onClick={onEdgeOpen}
              onMouseEnter={setEdgeHover}
              onMouseLeave={clearEdgeHover}
            />
          ))}
          {nodes.map(n => (
            <Node
              key={n.id}
              node={n}
              onMouseEnter={setNodeHover}
              onMouseLeave={clearNodeHover}
              onClick={onNodeOpen}
              hovering={nodeHover === n.id}
            />
          ))}
          {/*We split the labels from edges so that thay are shown on top of everything else*/}
          {edges.map((e, index) => (
            <EdgeLabel
              key={e.id}
              edge={e}
              hovering={
                (e.source as NodeDatum).id === nodeHover ||
                (e.target as NodeDatum).id === nodeHover ||
                edgeHover === e.id
              }
            />
          ))}
        </g>
      </svg>

      <div className={styles.viewControls}>
        <ViewControls<Config>
          config={config}
          onConfigChange={setConfig}
          onMinus={onStepDown}
          onPlus={onStepUp}
          scale={scale}
        />
      </div>

      {MenuComponent}
    </div>
  );
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
function processServices(nodes: DataFrame, edges: DataFrame): { nodes: NodeDatum[]; links: EdgeDatum[] } {
  const nodeFields = getNodeFields(nodes);

  const servicesMap =
    nodeFields.id?.values.toArray().reduce<{ [id: string]: NodeDatum }>((acc, id, index) => {
      acc[id] = {
        id: id,
        title: nodeFields.title.values.get(index),
        subTitle: nodeFields.subTitle.values.get(index),
        dataFrameRowIndex: index,
        incoming: 0,
        mainStat: statToString(nodeFields.mainStat, index),
        secondaryStat: statToString(nodeFields.secondaryStat, index),
        arcSections: nodeFields.arc.map(f => {
          return {
            value: f.values.get(index),
            color: f.config.color?.fixedColor || '',
          };
        }),
      };
      return acc;
    }, {}) || {};

  const edgeFields = getEdgeFields(edges);
  const edgesMapped = edgeFields.id?.values.toArray().map((id, index) => {
    const target = edgeFields.target?.values.get(index);
    const source = edgeFields.source?.values.get(index);
    // We are adding incoming edges count so we can later on find out which nodes are the roots
    servicesMap[target].incoming++;

    return {
      id,
      dataFrameRowIndex: index,
      source,
      target,
      mainStat: statToString(edgeFields.mainStat, index),
      secondaryStat: statToString(edgeFields.secondaryStat, index),
    } as EdgeDatum;
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
