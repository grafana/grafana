import React from 'react';

import { FieldColorModeId, FieldType, MutableDataFrame, NodeGraphDataFrameFieldNames } from '@grafana/data';
import { NodeGraph } from '@grafana/nodegraph';

import { FlameGraphDataContainer, LevelItem } from './FlameGraph/dataTransform';

type Props = {
  dataContainer: FlameGraphDataContainer;
};

export function FlameNodeGraph(props: Props) {
  const frames = flameToNodeDataFrame(props.dataContainer);

  return <NodeGraph dataFrames={[data!]} getLinks={() => []} />;
}

/**
 * Transforms a tree of flamegraph data into a node graph data frame.
 */
function flameToNodeDataFrame(dataContainer: FlameGraphDataContainer) {
  const root = dataContainer.getLevels()[0][0];
  const nodes = [];
  const edges = [];
  const stack = [root];

  while (stack.length > 0) {
    const node = stack.pop()!;
    const label = dataContainer.getLabel(node.itemIndexes[0]);

    nodes.push({
      id: label,
      name: label,
      value: node.value,
    });

    if (node.children) {
      for (let i = node.children.length - 1; i >= 0; i--) {
        const child = node.children[i];
        const childLabel = dataContainer.getLabel(child.itemIndexes[0]);

        edges.push({
          source: label,
          target: childLabel,
        });
        stack.push(child);
      }
    }
  }

  return {
    nodes,
    edges,
  };
}

function nodesFrame() {
  const fields = {
    [NodeGraphDataFrameFieldNames.id]: {
      values: [],
      type: FieldType.string,
    },
    [NodeGraphDataFrameFieldNames.title]: {
      values: [],
      type: FieldType.string,
    },
    [NodeGraphDataFrameFieldNames.mainStat]: {
      values: [],
      type: FieldType.number,
    },
    [NodeGraphDataFrameFieldNames.secondaryStat]: {
      values: [],
      type: FieldType.number,
    },
  };

  return new MutableDataFrame({
    name: 'nodes',
    fields: Object.entries(fields).map(([key, value]) => ({
      ...value,
      name: key,
    })),
  });
}
