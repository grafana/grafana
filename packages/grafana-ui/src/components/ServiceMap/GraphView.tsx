import React, { useState, useMemo, useCallback, MouseEvent, MutableRefObject } from 'react';
import useMeasure from 'react-use/lib/useMeasure';
import { usePanning } from './usePanning';
import { LinkDatum, NodeDatum, XrayEdge, XrayService } from './types';
import { computeStats } from './statsUtils';
import { Node } from './Node';
import { Link } from './Link';
import { ViewControls } from './ViewControls';
import { DataFrame, DataFrameView, LinkModel } from '@grafana/data';
import { useZoom } from './useZoom';
import { GraphContextMenu } from './GraphContextMenu';
import { useLayout, Config, defaultConfig } from './layout';

interface Props {
  services: DataFrame;
  edges: DataFrame;
  getNodeLinks: (node: NodeDatum) => LinkModel[];
  getEdgeLinks: (node: LinkDatum) => LinkModel[];
}
export function GraphView(props: Props) {
  const [measureRef, { width, height }] = useMeasure();
  const [config, setConfig] = useState<Config>(defaultConfig);

  const [nodeHover, setNodeHover] = useState<string | undefined>(undefined);
  const clearNodeHover = useCallback(() => setNodeHover(undefined), []);

  const { nodes: rawNodes, links: rawLinks } = useMemo(() => processServices(props.services, props.edges), [
    props.services,
    props.edges,
  ]);
  const { nodes, edges, bounds } = useLayout(rawNodes, rawLinks, config);

  const { scale, onStepDown, onStepUp, ref } = useZoom({
    stepDown: s => s / 1.5,
    stepUp: s => s * 1.5,
    min: 0.13,
    max: 2.25,
  });

  const { state: panningState, ref: panRef } = usePanning<SVGSVGElement>({
    scale,
    bounds,
  });
  const { position: panPosition, isPanning } = panningState;

  const [openedNode, setOpenedNode] = useState<{ node: NodeDatum; event: MouseEvent } | undefined>(undefined);
  const onNodeOpen = useCallback((event, node) => setOpenedNode({ node, event }), []);

  const [openedEdge, setOpenedEdge] = useState<{ edge: LinkDatum; event: MouseEvent } | undefined>(undefined);
  const onEdgeOpen = useCallback((event, edge) => setOpenedEdge({ edge, event }), []);

  return (
    <div
      ref={r => {
        measureRef(r);
        (ref as MutableRefObject<HTMLElement | null>).current = r;
      }}
      style={{ height: '100%', width: '100%', overflow: 'hidden', position: 'relative' }}
    >
      <svg
        ref={panRef}
        viewBox={`${-(width / 2)} ${-(height / 2)} ${width} ${height}`}
        style={{
          overflow: 'visible',
          width: '100%',
          height: '100%',
          userSelect: isPanning ? 'none' : 'unset',
        }}
      >
        <g
          style={{
            transform: `scale(${scale}) translate(${panPosition.x}px, ${panPosition.y}px)`,
            fontSize: 10,
          }}
        >
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

      <div style={{ position: 'absolute', left: 10, top: 10 }}>
        <ViewControls<any> config={config} onConfigChange={setConfig} onMinus={onStepDown} onPlus={onStepUp} />
      </div>

      {openedNode && (
        <GraphContextMenu
          event={openedNode.event}
          onClose={() => setOpenedNode(undefined)}
          links={props.getNodeLinks(openedNode.node)}
          header={<div>{openedNode.node.name}</div>}
        />
      )}

      {openedEdge && (
        <GraphContextMenu
          event={openedEdge.event}
          onClose={() => setOpenedEdge(undefined)}
          links={props.getEdgeLinks(openedEdge.edge)}
          header={
            <div>
              {(openedEdge.edge.source as NodeDatum).name} {'->'} {(openedEdge.edge.target as NodeDatum).name}
            </div>
          }
        />
      )}
    </div>
  );
}

/**
 * Transform nodes and edges dataframes into array of objects that the layout code can then work with.
 */
function processServices(services: DataFrame, edges: DataFrame): { nodes: NodeDatum[]; links: LinkDatum[] } {
  const servicesView = new DataFrameView<{ name: string; id: string; data: XrayService }>(services);
  const servicesMap = servicesView.toArray().reduce((acc, s, index) => {
    acc[s.id] = {
      name: s.name,
      type: s.data.Type,
      id: s.id,
      dataFrameRowIndex: index,
      incoming: 0,
      stats: computeStats(s.data),
    };
    return acc;
  }, {} as { [id: string]: NodeDatum });

  const edgesView = new DataFrameView<{ source: string; target: string; data: XrayEdge }>(edges);
  const edgesMapped = edgesView.toArray().map((edge, index) => {
    servicesMap[edge.target].incoming++;

    return {
      dataFrameRowIndex: index,
      source: edge.source,
      target: edge.target,
      stats: computeStats(edge.data),
    } as LinkDatum;
  });

  return {
    nodes: Object.values(servicesMap),
    links: edgesMapped,
  };
}

function LinkArrowMarker() {
  return (
    <defs>
      <marker
        id="triangle"
        viewBox="0 0 10 10"
        refX="8"
        refY="5"
        markerUnits="strokeWidth"
        markerWidth="10"
        markerHeight="10"
        orient="auto"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#999" />
      </marker>
    </defs>
  );
}
