import {
  DataFrame,
  DataQueryResponse,
  FieldType,
  MutableDataFrame,
  NodeGraphDataFrameFieldNames as Fields,
} from '@grafana/data';

import { JaegerServiceDependency } from './types';

interface Node {
  [Fields.id]: string;
  [Fields.title]: string;
}

interface Edge {
  [Fields.id]: string;
  [Fields.target]: string;
  [Fields.source]: string;
  [Fields.mainStat]: number;
}

/**
 * Error schema used by the Jaeger dependencies API.
 */
interface JaegerDependenciesResponseError {
  code: number;
  msg: string;
}

interface JaegerDependenciesResponse {
  data?: {
    errors?: JaegerDependenciesResponseError[];
    data?: JaegerServiceDependency[];
  };
}

/**
 * Transforms a Jaeger dependencies API response to a Grafana {@link DataQueryResponse}.
 * @param response Raw response data from the API proxy.
 */
export function mapJaegerDependenciesResponse(response: JaegerDependenciesResponse): DataQueryResponse {
  const errors = response?.data?.errors;
  if (errors) {
    return {
      data: [],
      errors: errors.map((e: JaegerDependenciesResponseError) => ({ message: e.msg, status: e.code })),
    };
  }
  const dependencies = response?.data?.data;
  if (dependencies) {
    return {
      data: convertDependenciesToGraph(dependencies),
    };
  }

  return { data: [] };
}

/**
 * Converts a list of Jaeger service dependencies to a Grafana {@link DataFrame} array suitable for the node graph panel.
 * @param dependencies List of Jaeger service dependencies as returned by the Jaeger dependencies API.
 */
function convertDependenciesToGraph(dependencies: JaegerServiceDependency[]): DataFrame[] {
  const servicesByName = new Map<string, Node>();
  const edges: Edge[] = [];

  for (const dependency of dependencies) {
    addServiceNode(dependency.parent, servicesByName);
    addServiceNode(dependency.child, servicesByName);

    edges.push({
      [Fields.id]: dependency.parent + '--' + dependency.child,
      [Fields.target]: dependency.child,
      [Fields.source]: dependency.parent,
      [Fields.mainStat]: dependency.callCount,
    });
  }

  const nodesFrame = new MutableDataFrame({
    fields: [
      { name: Fields.id, type: FieldType.string },
      { name: Fields.title, type: FieldType.string },
    ],
    meta: {
      preferredVisualisationType: 'nodeGraph',
    },
  });

  const edgesFrame = new MutableDataFrame({
    fields: [
      { name: Fields.id, type: FieldType.string },
      { name: Fields.target, type: FieldType.string },
      { name: Fields.source, type: FieldType.string },
      { name: Fields.mainStat, type: FieldType.string, config: { displayName: 'Call count' } },
    ],
    meta: {
      preferredVisualisationType: 'nodeGraph',
    },
  });

  for (const node of servicesByName.values()) {
    nodesFrame.add(node);
  }

  for (const edge of edges) {
    edgesFrame.add(edge);
  }

  return [nodesFrame, edgesFrame];
}

/**
 * Convenience function to register a service node in the dependency graph.
 * @param service Name of the service to register.
 * @param servicesByName Map of service nodes keyed name.
 */
function addServiceNode(service: string, servicesByName: Map<string, Node>) {
  if (!servicesByName.has(service)) {
    servicesByName.set(service, {
      [Fields.id]: service,
      [Fields.title]: service,
    });
  }
}
