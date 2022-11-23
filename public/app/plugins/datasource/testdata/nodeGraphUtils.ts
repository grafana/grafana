import {
  ArrayVector,
  FieldColorModeId,
  FieldDTO,
  FieldType,
  MutableDataFrame,
  NodeGraphDataFrameFieldNames,
} from '@grafana/data';

import { nodes, edges } from './testData/serviceMapResponse';

export function generateRandomNodes(count = 10) {
  const nodes = [];

  const root = {
    id: '0',
    title: 'root',
    subTitle: 'client',
    success: 1,
    error: 0,
    stat1: Math.random(),
    stat2: Math.random(),
    edges: [] as any[],
  };
  nodes.push(root);
  const nodesWithoutMaxEdges = [root];

  const maxEdges = 3;

  for (let i = 1; i < count; i++) {
    const node = makeRandomNode(i);
    nodes.push(node);
    const sourceIndex = Math.floor(Math.random() * Math.floor(nodesWithoutMaxEdges.length - 1));
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
    const sourceIndex = Math.floor(Math.random() * Math.floor(nodes.length - 1));
    const targetIndex = Math.floor(Math.random() * Math.floor(nodes.length - 1));
    if (sourceIndex === targetIndex || nodes[sourceIndex].id === '0' || nodes[sourceIndex].id === '0') {
      continue;
    }

    nodes[sourceIndex].edges.push(nodes[sourceIndex].id);
  }

  const nodeFields: Record<string, Omit<FieldDTO, 'name'> & { values: ArrayVector }> = {
    [NodeGraphDataFrameFieldNames.id]: {
      values: new ArrayVector(),
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
      values: new ArrayVector(),
      type: FieldType.string,
    },
    [NodeGraphDataFrameFieldNames.subTitle]: {
      values: new ArrayVector(),
      type: FieldType.string,
    },
    [NodeGraphDataFrameFieldNames.mainStat]: {
      values: new ArrayVector(),
      type: FieldType.number,
      config: { displayName: 'Transactions per second' },
    },
    [NodeGraphDataFrameFieldNames.secondaryStat]: {
      values: new ArrayVector(),
      type: FieldType.number,
      config: { displayName: 'Average duration' },
    },
    [NodeGraphDataFrameFieldNames.arc + 'success']: {
      values: new ArrayVector(),
      type: FieldType.number,
      config: { color: { fixedColor: 'green', mode: FieldColorModeId.Fixed }, displayName: 'Success' },
    },
    [NodeGraphDataFrameFieldNames.arc + 'errors']: {
      values: new ArrayVector(),
      type: FieldType.number,
      config: { color: { fixedColor: 'red', mode: FieldColorModeId.Fixed }, displayName: 'Errors' },
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

  const edgeFields: any = {
    [NodeGraphDataFrameFieldNames.id]: {
      values: new ArrayVector(),
      type: FieldType.string,
    },
    [NodeGraphDataFrameFieldNames.source]: {
      values: new ArrayVector(),
      type: FieldType.string,
    },
    [NodeGraphDataFrameFieldNames.target]: {
      values: new ArrayVector(),
      type: FieldType.string,
    },
  };

  const edgesFrame = new MutableDataFrame({
    name: 'edges',
    fields: Object.keys(edgeFields).map((key) => ({
      ...edgeFields[key],
      name: key,
    })),
    meta: { preferredVisualisationType: 'nodeGraph' },
  });

  const edgesSet = new Set();
  for (const node of nodes) {
    nodeFields.id.values.add(node.id);
    nodeFields.title.values.add(node.title);
    nodeFields[NodeGraphDataFrameFieldNames.subTitle].values.add(node.subTitle);
    nodeFields[NodeGraphDataFrameFieldNames.mainStat].values.add(node.stat1);
    nodeFields[NodeGraphDataFrameFieldNames.secondaryStat].values.add(node.stat2);
    nodeFields.arc__success.values.add(node.success);
    nodeFields.arc__errors.values.add(node.error);
    for (const edge of node.edges) {
      const id = `${node.id}--${edge}`;
      // We can have duplicate edges when we added some more by random
      if (edgesSet.has(id)) {
        continue;
      }
      edgesSet.add(id);
      edgeFields.id.values.add(`${node.id}--${edge}`);
      edgeFields.source.values.add(node.id);
      edgeFields.target.values.add(edge);
    }
  }

  return [nodeFrame, edgesFrame];
}

function makeRandomNode(index: number) {
  const success = Math.random();
  const error = 1 - success;
  return {
    id: index.toString(),
    title: `service:${index}`,
    subTitle: 'service',
    success,
    error,
    stat1: Math.random(),
    stat2: Math.random(),
    edges: [],
  };
}

export function savedNodesResponse(): any {
  return [new MutableDataFrame(nodes), new MutableDataFrame(edges)];
}
