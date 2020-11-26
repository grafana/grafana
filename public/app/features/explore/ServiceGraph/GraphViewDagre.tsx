import React, { useState } from 'react';
import { SimulationNodeDatum } from 'd3-force';
import dagre, { GraphEdge, GraphLabel } from 'dagre';
import useMeasure from 'react-use/lib/useMeasure';
import { response } from './x-ray-response';
import { Button } from '@grafana/ui';

type NodeDatum = SimulationNodeDatum & { id: string; name: string; type: string; incoming: number };

export function GraphViewDagre() {
  const [scale, setScale] = useState(1);
  const [ref, { width, height }] = useMeasure();
  const [config, setConfig] = useState({
    collide: 100,
    linkDistance: 0,
    linkStrength: 1,
    chargeStrength: 0,
    xStrength: 0.1,
    x: 1000,
    yStrength: 1,
  });

  let { nodes, links } = processResponse(response);
  links = [...links, { source: '5', target: '9' }];
  const g = new dagre.graphlib.Graph<NodeDatum>();
  const gl: GraphLabel = {
    rankdir: 'LR',
  };
  g.setGraph(gl);
  for (const n of nodes) {
    g.setNode(n.id, n);
  }

  for (const l of links) {
    g.setEdge(l.source, l.target, l);
  }

  dagre.layout(g, { rankdir: 'LR', nodesep: 60 });

  return (
    <div ref={ref} style={{ height: 300, width: '100%', overflow: 'hidden', position: 'relative' }}>
      <svg
        viewBox={`${-(width / 2)} ${-(height / 2)} ${width} ${height}`}
        style={{
          overflow: 'visible',
          width: '100%',
          height: '100%',
          transform: `scale(${scale})`,
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

        {g.nodes().map(n => {
          const node = g.node(n);
          return <Node key={node.id} node={node} />;
        })}

        {g.edges().map((l, index) => {
          const edge = g.edge(l);
          return <Link key={index} link={edge} />;
        })}
      </svg>

      <div style={{ position: 'absolute', left: 10, top: 10 }}>
        <Button icon={'plus-circle'} onClick={() => setScale(s => s * 2)} />
        <Button icon={'minus-circle'} onClick={() => setScale(s => s / 2)} />
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
      </div>
    </div>
  );
}

function Link(props: { link: GraphEdge; scale?: number }) {
  const { link } = props;
  const [source, target] = link.points;
  const line = {
    x1: source.x,
    y1: source.y,
    x2: target.x,
    y2: target.y,
  };

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

function processResponse(response: any): { nodes: NodeDatum[]; links: { source: string; target: string }[] } {
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
        width: 60,
        height: 60,
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
