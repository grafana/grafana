import { randomLcg } from 'd3-random';

import {
  FieldColorModeId,
  FieldDTO,
  FieldType,
  MutableDataFrame,
  NodeGraphDataFrameFieldNames,
  DataFrame,
} from '@grafana/data';

import * as serviceMapResponseSmall from './testData/serviceMapResponse';
import * as serviceMapResponsMedium from './testData/serviceMapResponseMedium';

export function generateRandomNodes(count = 10, seed?: number) {
  const nodes = [];
  const edges: string[] = [];
  const rand = randomLcg(seed);

  const root = {
    id: 'root',
    title: 'root',
    subTitle: 'client',
    success: 1,
    error: 0,
    stat1: Math.random(),
    stat2: Math.random(),
    edges,
  };
  nodes.push(root);
  const nodesWithoutMaxEdges = [root];

  const maxEdges = 3;

  for (let i = 1; i < count; i++) {
    const node = makeRandomNode(i);
    nodes.push(node);
    const sourceIndex = Math.floor(rand() * Math.floor(nodesWithoutMaxEdges.length - 1));
    const source = nodesWithoutMaxEdges[sourceIndex];
    source.edges.push(node.id);
    if (source.edges.length >= maxEdges) {
      nodesWithoutMaxEdges.splice(sourceIndex, 1);
    }
    nodesWithoutMaxEdges.push(node);
  }

  // Add some random edges to create possible cycle
  const additionalEdges = Math.floor(count / 2);
  for (let i = 0; i <= additionalEdges; i++) {
    const sourceIndex = Math.floor(rand() * Math.floor(nodes.length - 1));
    const targetIndex = Math.floor(rand() * Math.floor(nodes.length - 1));
    if (sourceIndex === targetIndex || nodes[sourceIndex].id === '0' || nodes[targetIndex].id === '0') {
      continue;
    }

    nodes[sourceIndex].edges.push(nodes[targetIndex].id);
  }

  const nodeFields: Record<string, Omit<FieldDTO, 'name'> & { values: any[] }> = {
    [NodeGraphDataFrameFieldNames.id]: {
      values: [],
      type: FieldType.string,
      config: {
        links: [
          {
            title: 'test data link',
            url: '',
            internal: {
              query: { scenarioId: 'logs', alias: 'from service graph', stringInput: 'tes' },
              datasourceUid: 'gdev-testdata',
              datasourceName: 'gdev-testdata',
            },
          },
        ],
      },
    },
    [NodeGraphDataFrameFieldNames.title]: {
      values: [],
      type: FieldType.string,
    },
    [NodeGraphDataFrameFieldNames.subTitle]: {
      values: [],
      type: FieldType.string,
    },
    [NodeGraphDataFrameFieldNames.mainStat]: {
      values: [],
      type: FieldType.number,
      config: { displayName: 'Transactions per second' },
    },
    [NodeGraphDataFrameFieldNames.secondaryStat]: {
      values: [],
      type: FieldType.number,
      config: { displayName: 'Average duration' },
    },
    [NodeGraphDataFrameFieldNames.arc + 'success']: {
      values: [],
      type: FieldType.number,
      config: { color: { fixedColor: 'green', mode: FieldColorModeId.Fixed }, displayName: 'Success' },
    },
    [NodeGraphDataFrameFieldNames.arc + 'errors']: {
      values: [],
      type: FieldType.number,
      config: { color: { fixedColor: 'red', mode: FieldColorModeId.Fixed }, displayName: 'Errors' },
    },
    [NodeGraphDataFrameFieldNames.icon]: {
      values: [],
      type: FieldType.string,
    },
    [NodeGraphDataFrameFieldNames.nodeRadius]: {
      values: [],
      type: FieldType.number,
    },
    [NodeGraphDataFrameFieldNames.highlighted]: {
      values: [],
      type: FieldType.boolean,
    },
  };

  const nodeFrame = new MutableDataFrame({
    name: 'nodes',
    fields: Object.keys(nodeFields).map((key) => ({
      ...nodeFields[key],
      name: key,
    })),
    meta: { preferredVisualisationType: 'nodeGraph' },
  });

  const edgesFrame: DataFrame = {
    name: 'edges',
    fields: [
      { name: NodeGraphDataFrameFieldNames.id, values: [], type: FieldType.string, config: {} },
      { name: NodeGraphDataFrameFieldNames.source, values: [], type: FieldType.string, config: {} },
      { name: NodeGraphDataFrameFieldNames.target, values: [], type: FieldType.string, config: {} },
      { name: NodeGraphDataFrameFieldNames.mainStat, values: [], type: FieldType.number, config: {} },
      { name: NodeGraphDataFrameFieldNames.highlighted, values: [], type: FieldType.boolean, config: {} },
      { name: NodeGraphDataFrameFieldNames.thickness, values: [], type: FieldType.number, config: {} },
    ],
    meta: { preferredVisualisationType: 'nodeGraph' },
    length: 0,
  };

  const edgesSet = new Set();
  for (const node of nodes) {
    nodeFields.id.values.push(node.id);
    nodeFields.title.values.push(node.title);
    nodeFields[NodeGraphDataFrameFieldNames.subTitle].values.push(node.subTitle);
    nodeFields[NodeGraphDataFrameFieldNames.mainStat].values.push(node.stat1);
    nodeFields[NodeGraphDataFrameFieldNames.secondaryStat].values.push(node.stat2);
    nodeFields.arc__success.values.push(node.success);
    nodeFields.arc__errors.values.push(node.error);
    const rnd = Math.random();
    nodeFields[NodeGraphDataFrameFieldNames.icon].values.push(rnd > 0.9 ? 'database' : rnd < 0.1 ? 'cloud' : '');
    nodeFields[NodeGraphDataFrameFieldNames.nodeRadius].values.push(Math.max(rnd * 100, 30)); // ensure a minimum radius of 30 or icons will not fit well in the node
    nodeFields[NodeGraphDataFrameFieldNames.highlighted].values.push(Math.random() > 0.5);

    for (const edge of node.edges) {
      const id = `${node.id}--${edge}`;
      // We can have duplicate edges when we added some more by random
      if (edgesSet.has(id)) {
        continue;
      }
      edgesSet.add(id);
      edgesFrame.fields[0].values.push(`${node.id}--${edge}`);
      edgesFrame.fields[1].values.push(node.id);
      edgesFrame.fields[2].values.push(edge);
      edgesFrame.fields[3].values.push(Math.random() * 100);
      edgesFrame.fields[4].values.push(Math.random() > 0.5);
      edgesFrame.fields[5].values.push(Math.ceil(Math.random() * 15));
    }
  }
  edgesFrame.length = edgesFrame.fields[0].values.length;

  return [nodeFrame, edgesFrame];
}

function makeRandomNode(index: number) {
  const success = Math.random();
  const error = 1 - success;
  return {
    id: `service:${index}`,
    title: `service:${index}`,
    subTitle: 'service',
    success,
    error,
    stat1: Math.random(),
    stat2: Math.random(),
    edges: [],
    highlighted: Math.random() > 0.5,
  };
}

export function savedNodesResponse(size: 'small' | 'medium'): [DataFrame, DataFrame] {
  const response = size === 'small' ? serviceMapResponseSmall : serviceMapResponsMedium;
  return [new MutableDataFrame(response.nodes), new MutableDataFrame(response.edges)];
}

// Generates node graph data but only returns the edges
export function generateRandomEdges(count = 10, seed = 1) {
  return generateRandomNodes(count, seed)[1];
}
