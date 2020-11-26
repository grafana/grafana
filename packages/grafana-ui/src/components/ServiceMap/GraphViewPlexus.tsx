import React from 'react';
import { response } from './x-ray-response';
import { TEdge, TVertex } from '@jaegertracing/plexus/lib/types';
import { DirectedGraph, LayoutManager } from '@jaegertracing/plexus';

export function GraphViewPlexus() {
  let { nodes, links } = processResponse(response);
  links = [...links, { from: '5', to: '9' }];

  return <DirectedGraph edges={links} vertices={nodes} layoutManager={new LayoutManager()} />;
}

function processResponse(response: any): { nodes: TVertex[]; links: TEdge[] } {
  const { nodes, links } = response.Services.reduce(
    (acc: any, service: any) => {
      const links = service.Edges.map((e: any) => {
        return {
          from: service.ReferenceId,
          to: e.ReferenceId,
        };
      });

      acc.links.push(...links);

      const node = {
        key: service.ReferenceId,
        label: service.Name,
        data: {
          name: service.Name,
          type: service.Type,
          incoming: 0,
        },
      };
      acc.nodes.push(node);

      return acc;
    },
    { nodes: [], links: [] }
  );

  return {
    nodes: Object.values(nodes),
    links,
  };
}
