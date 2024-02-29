import React from 'react';

import { addRow, DataFrame, FieldType, NodeGraphDataFrameFieldNames } from '@grafana/data';
import { NodeGraph } from '@grafana/nodegraph';

import { FlameGraphDataContainer } from '../FlameGraph/dataTransform';

import { makeEdgeKey } from './edgeUtils';
import { calcMaxAndSumValues, trimGraphNodesAndEdges } from './graphTrimming';
import { treeToGraph } from './treeTransforms';

type Props = {
  dataContainer: FlameGraphDataContainer;
};

export function FlameNodeGraph(props: Props) {
  const frames = flameToNodeDataFrame(props.dataContainer);
  return <NodeGraph dataFrames={frames} getLinks={() => []} layoutType={'layered'} />;
}

const nodeFraction = 0.005;
const edgeFraction = 0.001;
const maxNodes = 80;

/**
 * Transforms a tree of flamegraph data into a node graph data frame.
 */
function flameToNodeDataFrame(dataContainer: FlameGraphDataContainer) {
  const root = dataContainer.getLevels()[0][0];
  const { sumTotal } = calcMaxAndSumValues(root);
  const { nodes, edges } = treeToGraph(root);

  // next is we need to trim graph to remove small nodes
  const nodeCutoff = sumTotal * nodeFraction;
  const edgeCutoff = sumTotal * edgeFraction;

  const trimOptions = {
    nodeCutoff,
    edgeCutoff,
    maxNodes,
  };
  const { nodes: trimmedNodes, edges: trimmedEdges } = trimGraphNodesAndEdges(root, nodes, edges, trimOptions);

  const nodesFrame = makeNodesFrame();
  const edgesFrame = makeEdgesFrame();

  for (const node of Object.values(trimmedNodes)) {
    addRow(nodesFrame, {
      [NodeGraphDataFrameFieldNames.id]: node.label,
      [NodeGraphDataFrameFieldNames.title]: node.label,
      [NodeGraphDataFrameFieldNames.mainStat]: node.value,
      [NodeGraphDataFrameFieldNames.secondaryStat]: node.self,
    });
  }

  for (const edge of Object.values(trimmedEdges)) {
    addRow(edgesFrame, {
      [NodeGraphDataFrameFieldNames.id]: makeEdgeKey(edge.from.label, edge.to.label),
      [NodeGraphDataFrameFieldNames.source]: edge.from.label,
      [NodeGraphDataFrameFieldNames.target]: edge.to.label,
    });
  }

  return [nodesFrame, edgesFrame];
}

function makeNodesFrame(): DataFrame {
  return {
    fields: [
      {
        name: NodeGraphDataFrameFieldNames.id,
        type: FieldType.string,
        config: {},
        values: [],
      },

      {
        name: NodeGraphDataFrameFieldNames.title,
        type: FieldType.string,
        config: {},
        values: [],
      },

      {
        name: NodeGraphDataFrameFieldNames.mainStat,
        type: FieldType.number,
        config: {},
        values: [],
      },

      {
        name: NodeGraphDataFrameFieldNames.secondaryStat,
        type: FieldType.number,
        config: {},
        values: [],
      },
    ],
    length: 0,
  };
}

function makeEdgesFrame(): DataFrame {
  return {
    fields: [
      {
        name: NodeGraphDataFrameFieldNames.id,
        type: FieldType.string,
        config: {},
        values: [],
      },

      {
        name: NodeGraphDataFrameFieldNames.source,
        type: FieldType.string,
        config: {},
        values: [],
      },

      {
        name: NodeGraphDataFrameFieldNames.target,
        type: FieldType.string,
        config: {},
        values: [],
      },
    ],
    length: 0,
  };
}
