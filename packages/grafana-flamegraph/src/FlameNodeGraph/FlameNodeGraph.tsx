import React from 'react';

import { addRow, DataFrame, FieldType, NodeGraphDataFrameFieldNames } from '@grafana/data';
import { NodeGraph } from '@grafana/nodegraph';

import { FlameGraphDataContainer, LevelItem } from '../FlameGraph/dataTransform';

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
  const { maxSelf, maxTotal, sumSelf, sumTotal } = calcMaxAndSumValues(root);
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
  // We will use index as ID. Nodes in profile don't have unique id as they are unique by their position in a stack.
  let nodeIndex = 0;

  const stack = [{ levelItem: root, index: nodeIndex }];

  while (stack.length > 0) {
    const item = stack.pop()!;
    const node = item.levelItem;
    const label = dataContainer.getLabel(node.itemIndexes[0]);
    const nodeId = item.index + '-' + label;

    addRow(nodesFrame, {
      [NodeGraphDataFrameFieldNames.id]: nodeId,
      [NodeGraphDataFrameFieldNames.title]: label,
      [NodeGraphDataFrameFieldNames.mainStat]: node.value,
      [NodeGraphDataFrameFieldNames.secondaryStat]: node.self,
    });

    if (node.children) {
      for (let i = node.children.length - 1; i >= 0; i--) {
        nodeIndex++;
        const child = node.children[i];
        const childLabel = dataContainer.getLabel(child.itemIndexes[0]);
        const childId = nodeIndex + '-' + childLabel;

        addRow(edgesFrame, {
          [NodeGraphDataFrameFieldNames.id]: `${nodeId}-${childId}`,
          [NodeGraphDataFrameFieldNames.source]: nodeId,
          [NodeGraphDataFrameFieldNames.target]: childId,
        });

        stack.push({ levelItem: child, index: nodeIndex });
      }
    }
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
