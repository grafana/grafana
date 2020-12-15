import React, { useEffect, useState, useMemo, useCallback, MouseEvent, MutableRefObject } from 'react';
import { forceSimulation, forceLink, forceManyBody, forceCollide } from 'd3-force';
import useMeasure from 'react-use/lib/useMeasure';
// import { response } from './x-ray-response';
import { usePanning } from './usePanning';
import { LinkDatum, NodeDatum, XrayEdge, XrayService } from './types';
import { computeStats } from './statsUtils';
import { Node } from './Node';
import { Link } from './Link';
import { ViewControls } from './ViewControls';
import { ContextMenu } from '..';
import { DataFrame, DataFrameView, LinkModel } from '@grafana/data';
import { useZoom } from './useZoom';

interface Config extends Record<string, number> {
  collide: number;
  linkDistance: number;
  chargeStrength: number;
}

interface Props {
  services: DataFrame;
  edges: DataFrame;
  getNodeLinks: (node: NodeDatum) => LinkModel[];
  getEdgeLinks: (node: LinkDatum) => LinkModel[];
}
export function GraphView(props: Props) {
  const [measureRef, { width, height }] = useMeasure();
  const [config, setConfig] = useState<Config>({
    collide: 120,
    linkDistance: 70,
    chargeStrength: -100,
  });
  const [useTestData, setUseTestData] = useState(false);
  const [nodeHover, setNodeHover] = useState<string | undefined>(undefined);
  // const [linkHover, setLinkHover] = useState<number | undefined>(undefined);
  const clearNodeHover = useCallback(() => setNodeHover(undefined), []);

  const { nodes: rawNodes, links: rawLinks } = useMemo(() => processServices(props.services, props.edges), [
    props.services,
    props.edges,
  ]);
  const { nodes, links, bounds } = useLayout(rawNodes, rawLinks, config);

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
          {links.map((l, index) => (
            <Link
              key={index}
              link={l}
              showStats={(l.source as NodeDatum).id === nodeHover || (l.target as NodeDatum).id === nodeHover}
              onClick={onEdgeOpen}
            />
          ))}
          {nodes.map(n => (
            <Node key={n.id} node={n} onMouseEnter={setNodeHover} onMouseLeave={clearNodeHover} onClick={onNodeOpen} />
          ))}

          {/*<Node*/}
          {/*  node={{*/}
          {/*    id: '0',*/}
          {/*    incoming: 0,*/}
          {/*    x: 0,*/}
          {/*    y: 0,*/}
          {/*    name: 'test',*/}
          {/*    type: 'test',*/}
          {/*    stats: {*/}
          {/*      tracesPerMinute: 0,*/}
          {/*      avgResponseTime: 0,*/}
          {/*      success: 0.46090105573287504,*/}
          {/*      errors: 0,*/}
          {/*      faults: 0.539098944267125,*/}
          {/*      throttled: 0,*/}
          {/*    },*/}
          {/*  }}*/}
          {/*/>*/}
        </g>
      </svg>

      <div style={{ position: 'absolute', left: 10, top: 10 }}>
        <ViewControls<Config>
          config={config}
          onConfigChange={setConfig}
          onUseTestDataChange={setUseTestData}
          useTestData={useTestData}
          onMinus={onStepDown}
          onPlus={onStepUp}
        />
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

function GraphContextMenu({
  header,
  onClose,
  links,
  event,
}: {
  header: React.ReactNode;
  onClose: () => void;
  links: LinkModel[];
  event: MouseEvent;
}) {
  if (!links.length) {
    return null;
  }

  return (
    <ContextMenu
      renderHeader={() => header}
      items={[
        {
          label: 'Open in Explore',
          items: links.map(link => ({
            label: link.title,
            url: link.href,
            onClick: link.onClick,
          })),
        },
      ]}
      onClose={onClose}
      x={event.pageX}
      y={event.pageY}
    />
  );
}

function useLayout(rawNodes: NodeDatum[], rawLinks: LinkDatum[], config: Config) {
  const [nodes, setNodes] = useState<NodeDatum[]>([]);
  const [links, setLinks] = useState<LinkDatum[]>([]);

  // TODO the use effect is probably not needed here right now, but may make sense later if we decide to move the layout
  // to webworker or just postpone until other things are rendered
  useEffect(() => {
    // TODO figure out a good way to put roots in fixed position on the left
    // const roots = nodes.filter(n => n.incoming === 0);
    // roots.forEach((n, index) => {
    //   n.fx = -500;
    //   n.fy = index * 200;
    // });

    const simulation = forceSimulation(rawNodes)
      .force('collide', forceCollide(config.collide))
      .force(
        'link',
        forceLink(rawLinks)
          .id((d: any) => d.id)
          .distance(config.linkDistance)
      )
      .force('charge', forceManyBody().strength(config.chargeStrength));

    simulation.tick(300);
    // could use a center force but that dose not work well if we want to fix some nodes somewhere (not doing that
    // right now though)
    centerNodes(rawNodes);
    setNodes(rawNodes);
    setLinks(rawLinks);
  }, [config, rawNodes, rawLinks]);

  return { nodes, links, bounds: nodeBounds(nodes) };
}

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

function centerNodes(nodes: NodeDatum[]) {
  const bounds = nodeBounds(nodes);
  const middleY = bounds.top + (bounds.bottom - bounds.top) / 2;
  const middleX = bounds.left + (bounds.right - bounds.left) / 2;

  for (let node of nodes) {
    node.x = node.x! - middleX;
    node.y = node.y! - middleY;
  }
}

function nodeBounds(nodes: NodeDatum[]): { top: number; right: number; bottom: number; left: number } {
  return nodes.reduce(
    (acc, node) => {
      if (node.x! > acc.right) {
        acc.right = node.x!;
      }
      if (node.x! < acc.left) {
        acc.left = node.x!;
      }
      if (node.y! > acc.bottom) {
        acc.bottom = node.y!;
      }
      if (node.y! < acc.top) {
        acc.top = node.y!;
      }
      return acc;
    },
    { top: Infinity, right: -Infinity, bottom: -Infinity, left: Infinity }
  );
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
