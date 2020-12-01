import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { forceSimulation, forceLink, forceManyBody, forceCollide } from 'd3-force';
import useMeasure from 'react-use/lib/useMeasure';
import { response } from './x-ray-response';
import { usePanning } from './usePanning';
import { LinkDatum, NodeDatum, XrayEdge, XrayService } from './types';
import { computeStats } from './statsUtils';
import { Node } from './Node';
import { Link } from './Link';
import { ViewControls } from './ViewControls';

interface Config extends Record<string, number> {
  collide: number;
  linkDistance: number;
  chargeStrength: number;
}

interface Props {
  services: any[];
}
export function GraphView(props: Props) {
  const [scale, setScale] = useState(0.5);
  const [measureRef, { width, height }] = useMeasure();
  const [config, setConfig] = useState<Config>({
    collide: 200,
    linkDistance: 100,
    chargeStrength: -100,
  });
  const [useTestData, setUseTestData] = useState(false);
  const [nodeHover, setNodeHover] = useState<string | undefined>(undefined);
  // const [linkHover, setLinkHover] = useState<number | undefined>(undefined);
  const clearNodeHover = useCallback(() => setNodeHover(undefined), []);

  const panRef = React.useRef<SVGSVGElement>(null);
  const { position: panPosition, isPanning } = usePanning(panRef);

  const services = useTestData ? response.Services : props.services;
  const { nodes: rawNodes, links: rawLinks } = useMemo(() => processServices(services), [services]);
  const { nodes, links } = useLayout(rawNodes, rawLinks, config);

  return (
    <div ref={measureRef} style={{ height: '100%', width: '100%', overflow: 'hidden', position: 'relative' }}>
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
            transform: `scale(${scale}) translate(${panPosition.x / scale}px, ${panPosition.y / scale}px)`,
          }}
        >
          <LinkArrowMarker />
          {links.map((l, index) => (
            <Link
              key={index}
              link={l}
              showStats={(l.source as NodeDatum).id === nodeHover || (l.target as NodeDatum).id === nodeHover}
            />
          ))}
          {nodes.map(n => (
            <Node key={n.id} node={n} onMouseEnter={setNodeHover} onMouseLeave={clearNodeHover} />
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
          onScaleChange={setScale}
          onUseTestDataChange={setUseTestData}
          scale={scale}
          useTestData={useTestData}
        />
      </div>
    </div>
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
    centerNodes(nodes);
    setNodes(rawNodes);
    setLinks(rawLinks);
  }, [config, rawNodes, rawLinks]);

  return { nodes, links };
}

function processServices(services: XrayService[]): { nodes: NodeDatum[]; links: LinkDatum[] } {
  const { nodes, links } = services.reduce(
    (acc: any, service: any) => {
      const links = service.Edges.map((e: XrayEdge) => {
        return {
          source: service.ReferenceId,
          target: e.ReferenceId,
          stats: computeStats(e),
        };
      });

      acc.links.push(...links);

      const node = {
        name: service.Name,
        type: service.Type,
        id: service.ReferenceId,
        incoming: 0,
        stats: computeStats(service),
      };
      acc.nodes = {
        ...acc.nodes,
        [node.id]: node,
      };

      return acc;
    },
    { nodes: {}, links: [] }
  );

  for (const link of links) {
    nodes[link.target].incoming++;
  }

  return {
    nodes: Object.values(nodes),
    links,
  };
}

function centerNodes(nodes: NodeDatum[]) {
  const bounds = nodes.reduce(
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

  const middleY = bounds.top + (bounds.bottom - bounds.top) / 2;
  const middleX = bounds.left + (bounds.right - bounds.left) / 2;

  for (let node of nodes) {
    node.x = node.x! - middleX;
    node.y = node.y! - middleY;
  }
}

function LinkArrowMarker() {
  return (
    <defs>
      <marker
        id="triangle"
        viewBox="0 0 10 10"
        refX="10"
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
