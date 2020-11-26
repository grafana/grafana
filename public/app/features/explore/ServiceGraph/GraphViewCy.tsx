import { fromPairs } from 'lodash';
import React, { useEffect, useState } from 'react';
import { SimulationNodeDatum, SimulationLinkDatum } from 'd3-force';
import useMeasure from 'react-use/lib/useMeasure';
import { response } from './x-ray-response';
import cytoscape, { ElementDefinition } from 'cytoscape';
import { Button } from '@grafana/ui';

type NodeDatum = SimulationNodeDatum & { id: string; name: string; type: string; incoming: number };
type LinkDatum = SimulationLinkDatum<NodeDatum>;

export function GraphViewCy() {
  const [nodes, setNodes] = useState<NodeDatum[]>([]);
  const [links, setLinks] = useState<LinkDatum[]>([]);
  const [scale, setScale] = useState(1);
  const [ref, { width, height }] = useMeasure();

  // const [linkStrength, setLinkStrength] = useState(1);
  // const [charge, setCharge] = useState(1);
  // const [scale, setScale] = useState(1);

  // const links = [
  //   { source: 'Alice', target: 'Bob' },
  //   { source: 'Bob', target: 'Carol' },
  // ];

  useEffect(() => {
    // const nodes: any[] = [{ id: 'Alice' }, { id: 'Bob' }, { id: 'Carol' }];
    const { nodes, links } = processResponse(response);
    const cy = cytoscape({
      elements: [...nodes, ...links],
      headless: true,
      style: [
        {
          selector: 'node',
          style: {
            width: '60',
            height: '60',
          },
        },
      ],
    });
    const layout = cy.layout({
      name: 'cose',
      componentSpacing: 2000,
      fit: false,
      nodeOverlap: 4000,
    });
    layout.on('layoutstop', () => {
      // console.log({ layout, elements: cy.elements(), json: cy.json() });
      const jsonGraph = cy.json();

      const nodes = (jsonGraph as any).elements.nodes.map((n: any) => {
        return {
          ...n.data,
          ...n.position,
        };
      });
      setNodes(nodes);
      const nodesMap = fromPairs(nodes.map((n: NodeDatum) => [n.id, n]));

      setLinks(
        (jsonGraph as any).elements.edges.map((e: any) => {
          return {
            source: nodesMap[e.data.source],
            target: nodesMap[e.data.target],
          };
        })
      );
    });
    layout.start();
  }, []);

  // const scale = 1;

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

        {nodes.map(n => (
          <Node key={n.id} node={n} />
        ))}

        {links.map((l, index) => (
          <Link key={index} link={l} />
        ))}
      </svg>

      <div style={{ position: 'absolute', left: 10, top: 10 }}>
        <Button icon={'plus-circle'} onClick={() => setScale(s => s * 2)} />
        <Button icon={'minus-circle'} onClick={() => setScale(s => s / 2)} />
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

function processResponse(response: any): { nodes: ElementDefinition[]; links: ElementDefinition[] } {
  return response.Services.reduce(
    (acc: any, service: any) => {
      const links = service.Edges.map((e: any) => {
        return {
          data: {
            id: `${service.ReferenceId}-${e.ReferenceId}`,
            source: service.ReferenceId,
            target: e.ReferenceId,
          },
        };
      });

      acc.links.push(...links);

      const node = {
        data: {
          name: service.Name,
          type: service.Type,
          id: service.ReferenceId,
          width: 58,
          height: 58,
          w: 58,
          h: 58,
        },
        css: {
          width: '58px',
          height: '58px',
        },
      };

      acc.nodes.push(node);

      return acc;
    },
    { nodes: [], links: [] }
  );
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
