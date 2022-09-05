import React, { useState } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import dagre from 'dagre';
import ReactFlow, { ConnectionLineType, Node, Edge, Position } from 'react-flow-renderer';
import { isDataNode, isLayoutNode, isLayoutState, isParametrizedState } from '../core/typeguards';
import { Drawer, RadioButtonGroup } from '@grafana/ui';
import { SceneObjectBase } from '../core/SceneObjectBase';
import { SceneObject } from '../core/types';
import { Scene } from './Scene';

export function SceneInspectGraph({ model, onClose }: any) {
  const { children } = model.useState();
  const [previewMode, setPreviewMode] = useState<string>('all');
  const flattenedNodes = flattenSceneNodes(children);

  const nodes = [];
  const flowNodes: Node[] = [];
  const flowEdges: Edge[] = [];

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  for (let [key, value] of flattenedNodes) {
    if (previewMode === 'data' && isDataNode(value)) {
      flowNodes.push({
        id: value.state.key!,
        type: undefined,
        data: { label: value.constructor.name },
        position: { x: 0, y: 0 },
      });
    } else if (previewMode === 'layout' && isLayoutNode(value)) {
      flowNodes.push({
        id: value.state.key!,
        // type: value.parent instanceof Scene ? 'input' : undefined,
        data: { label: value.constructor.name },
        position: { x: 0, y: 0 },
      });
    } else if (previewMode === 'all') {
      flowNodes.push({
        id: value.state.key!,
        data: { label: value.constructor.name },
        position: { x: 0, y: 0 },
      });
    }

    if (isParametrizedState(value.state)) {
      for (const [_, param] of Object.entries(value.state.inputParams)) {
        flowEdges.push({
          id: `${param.state.key}_${value.state.key}`,
          source: param.state.key!,
          target: value.state.key!,
          animated: true,
        });
      }
    }

    if (value.parent && !(value.parent instanceof Scene)) {
      flowEdges.push({
        id: `${value.parent.state.key}_${value.state.key}`,
        source: value.parent.state.key!,
        target: value.state.key!,
      });
    }

    nodes.push(
      <li key={key}>
        {key} - {value.constructor.name} - {value.isActive ? 'active' : 'inactive'}
      </li>
    );
  }

  const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(dagreGraph, flowNodes, flowEdges);

  return (
    <Drawer onClose={onClose} width="100%">
      <RadioButtonGroup
        value={previewMode}
        options={[
          { label: 'All nodes', value: 'all' },
          { label: 'Data nodes', value: 'data' },
          { label: 'Layout nodes', value: 'layout' },
        ]}
        onChange={setPreviewMode}
      />
      <div style={{ height: '100%', overflow: 'hidden', flexGrow: 1 }}>
        <AutoSizer>
          {({ width, height }) => {
            return (
              <div style={{ width, height }}>
                <ReactFlow
                  nodes={layoutedNodes}
                  edges={layoutedEdges}
                  connectionLineType={ConnectionLineType.Straight}
                  fitView
                />
              </div>
            );
          }}
        </AutoSizer>
      </div>
    </Drawer>
  );
}

function getAllSceneNodes(model: SceneObject[]): Array<{ key: string; node: SceneObjectBase }> {
  let result: any = [];

  model.forEach((child) => {
    result.push({ key: child.state.key, node: child });

    // collect nodes that are provided as input params
    if (isParametrizedState(child.state)) {
      for (const [_, param] of Object.entries(child.state.inputParams)) {
        if (param instanceof SceneObjectBase) {
          result = result.concat(getAllSceneNodes([param]));
        }
      }
    }
    if (isLayoutState(child.state)) {
      result = result.concat(getAllSceneNodes(child.state.children));
    }
  });

  return result;
}

function flattenSceneNodes(model: SceneObjectBase[]): Map<string, SceneObject> {
  const nodes = getAllSceneNodes(model);
  const m = new Map();
  nodes.forEach((node) => {
    m.set(node.key, node.node);
  });

  return m;
}

const getLayoutedElements = (dagreGraph: dagre.graphlib.Graph<{}>, nodes: Node[], edges: Edge[], direction = 'TB') => {
  const nodeWidth = 172;
  const nodeHeight = 36;

  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.targetPosition = isHorizontal ? Position.Left : Position.Top;
    node.sourcePosition = isHorizontal ? Position.Right : Position.Bottom;

    // We are shifting the dagre node position (anchor=center center) to the top left
    // so it matches the React Flow node anchor point (top left).
    node.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };

    return node;
  });

  return { nodes, edges };
};
