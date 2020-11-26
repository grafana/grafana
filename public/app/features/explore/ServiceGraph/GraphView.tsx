import React, { useEffect, useState } from 'react';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  SimulationNodeDatum,
  SimulationLinkDatum,
  forceCollide,
} from 'd3-force';
import useMeasure from 'react-use/lib/useMeasure';
import { response } from './x-ray-response';
import { Button } from '@grafana/ui';
import { usePanning } from './usePanning';

type NodeDatum = SimulationNodeDatum & { id: string; name: string; type: string; incoming: number };
type LinkDatum = SimulationLinkDatum<NodeDatum>;

type Props = {
  services: any[];
};
export function GraphView(props: Props) {
  const [nodes, setNodes] = useState<NodeDatum[]>([]);
  const [links, setLinks] = useState<LinkDatum[]>([]);
  const [scale, setScale] = useState(1);
  const [measureRef, { width, height }] = useMeasure();
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState({
    collide: 100,
    linkDistance: 100,
    chargeStrength: -100,
  });
  const [useTestData, setUseTestData] = useState(false);
  const panRef = React.useRef<SVGSVGElement>(null);
  const { position: panPosition, isPanning } = usePanning(panRef);

  useEffect(() => {
    // const nodes: any[] = [{ id: 'Alice' }, { id: 'Bob' }, { id: 'Carol' }];
    // let { nodes, links } = processResponse(response);
    let { nodes, links } = processResponse(useTestData ? response : { Services: props.services });
    // TODO figure out a good way to put roots in fixed position on the left
    // const roots = nodes.filter(n => n.incoming === 0);
    // roots.forEach((n, index) => {
    //   n.fx = -500;
    //   n.fy = index * 200;
    // });

    const simulation = forceSimulation(nodes)
      .force('collide', forceCollide(config.collide))
      .force(
        'link',
        forceLink(links)
          .id((d: any) => d.id)
          .distance(config.linkDistance)
      )
      .force('charge', forceManyBody().strength(config.chargeStrength));
    // .force('center', forceCenter());

    simulation.tick(300);
    // could use a center force but that dose not work well if we want to fix some nodes somewhere (not doing that
    // right now though)
    centerNodes(nodes);
    setNodes(nodes);
    setLinks(links);
  }, [config, props.services, useTestData]);

  return (
    <div ref={measureRef} style={{ height: 600, width: '100%', overflow: 'hidden', position: 'relative' }}>
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
            // transform: `scale(0.75) translate(${panPosition.x / scale}px, ${panPosition.y / scale}px)`,
          }}
        >
          <defs>
            <marker
              id="triangle"
              viewBox="0 0 10 10"
              refX="1"
              refY="5"
              markerUnits="strokeWidth"
              markerWidth="10"
              markerHeight="10"
              orient="auto"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#999" />
            </marker>
          </defs>

          {nodes.map(n => (
            <Node key={n.id} node={n} />
          ))}

          {links.map((l, index) => (
            <Link key={index} link={l} />
          ))}
        </g>
      </svg>

      <div style={{ position: 'absolute', left: 10, top: 10 }}>
        <Button icon={'plus-circle'} onClick={() => setScale(s => s * 1.5)} />
        <Button icon={'minus-circle'} onClick={() => setScale(s => s / 1.5)} />
        <Button size={'xs'} variant={'link'} onClick={() => setShowConfig(showConfig => !showConfig)}>
          {showConfig ? 'Hide config' : 'Show config'}
        </Button>

        {showConfig && (
          <>
            <div>
              Show test data
              <input type={'checkbox'} checked={useTestData} onChange={e => setUseTestData(e.currentTarget.checked)} />
            </div>
            {Object.keys(config).map((k: keyof typeof config) => (
              <div key={k}>
                {k}
                <input
                  style={{ width: 50 }}
                  type={'number'}
                  value={config[k]}
                  onChange={e => setConfig({ ...config, [k]: e.target.value })}
                />
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function Link(props: { link: LinkDatum; scale?: number }) {
  const { link } = props;
  const { source, target } = link as { source: NodeDatum; target: NodeDatum };
  const line = shortenLine(
    {
      x1: source.x!,
      y1: source.y!,
      x2: target.x!,
      y2: target.y!,
    },
    130
  );

  return <line stroke={'#999'} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} markerEnd="url(#triangle)" />;
}

function Node(props: { node: NodeDatum; scale?: number }) {
  const { node } = props;
  if (!(node.x !== undefined && node.y !== undefined)) {
    return null;
  }
  const scale = props.scale || 1;

  return (
    <g>
      <circle fill={'#fff'} stroke={'rgb(80, 171, 113)'} strokeWidth={2} r={58} cx={node.x * scale} cy={node.y * scale}>
        <title>{JSON.stringify(node)}</title>
      </circle>
      <text x={node.x * scale} y={node.y * scale} textAnchor={'middle'}>
        {node.name}
      </text>
      <text x={node.x * scale} y={node.y * scale + 20} textAnchor={'middle'}>
        {node.type}
      </text>
    </g>
  );
}

function processResponse(response: any): { nodes: NodeDatum[]; links: LinkDatum[] } {
  const { nodes, links } = response.Services.reduce(
    (acc: any, service: any) => {
      const links = service.Edges.map((e: any) => {
        return {
          source: service.ReferenceId,
          target: e.ReferenceId,
        };
      });

      acc.links.push(...links);

      const node = {
        name: service.Name,
        type: service.Type,
        id: service.ReferenceId,
        incoming: 0,
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

type Line = { x1: number; y1: number; x2: number; y2: number };
function shortenLine(line: Line, length: number): Line {
  const vx = line.x2 - line.x1;
  const vy = line.y2 - line.y1;
  const mag = Math.sqrt(vx * vx + vy * vy);
  const ratio = Math.max((mag - length) / mag, 0);
  const vx2 = vx * ratio;
  const vy2 = vy * ratio;
  const xDiff = vx - vx2;
  const yDiff = vy - vy2;
  const newx1 = line.x1 + xDiff / 2;
  const newy1 = line.y1 + yDiff / 2;
  return {
    x1: newx1,
    y1: newy1,
    x2: newx1 + vx2,
    y2: newy1 + vy2,
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
