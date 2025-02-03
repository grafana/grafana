import { compact, isArray, memoize, uniq } from 'lodash';
import memoizeOne from 'memoize-one';

import { Edge, Graph, Node } from 'app/core/utils/dag';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { AlertQuery } from 'app/types/unified-alerting-dto';

// memoized version of _createDagFromQueries to prevent recreating the DAG if no sources or targets are modified
export const createDagFromQueries = memoizeOne(
  _createDagFromQueries,
  (previous: Parameters<typeof _createDagFromQueries>, next: Parameters<typeof _createDagFromQueries>) => {
    return fingerPrintQueries(previous[0]) === fingerPrintQueries(next[0]);
  }
);

/**
 * Turn the array of alert queries (this means data queries and expressions)
 * in to a DAG, a directed acyclical graph
 */
export function _createDagFromQueries(queries: AlertQuery[]): Graph {
  const graph = new Graph();

  // collect link errors in here so we can throw a single error with all nodes that failed to link
  const linkErrors: LinkError[] = [];

  const nodes = queries.map((query) => query.refId);
  graph.createNodes(nodes);

  queries.forEach((query) => {
    if (!isExpressionQuery(query.model)) {
      return;
    }
    const source = query.refId;
    const isMathExpression = query.model.type === 'math';

    // some expressions have multiple targets (like the math expression)
    const targets = isMathExpression
      ? parseRefsFromMathExpression(query.model.expression ?? '')
      : [query.model.expression];

    targets.forEach((target) => {
      if (source && target) {
        try {
          graph.link(target, source);
        } catch (error) {
          linkErrors.push({ source, target, error });
        }
      }
    });
  });

  if (linkErrors.length > 0) {
    throw new Error('failed to create DAG from queries', { cause: linkErrors });
  }

  return graph;
}

// determine if inpout error is a DAGError
export function isDagError(error: unknown): error is DAGError {
  return isArray((error as DAGError).cause) && (error as DAGError).cause.every((e) => 'source' in e && 'target' in e);
}

interface LinkError {
  source: string;
  target: string;
  error: unknown;
}

interface DAGError extends Error {
  cause: LinkError[];
}

/**
 * parse an expression like "$A > $B" or "${FOO BAR} > 0" to an array of refIds
 */
export function parseRefsFromMathExpression(input: string): string[] {
  // we'll use two regular expressions, one for "${var}" and one for "$var"
  const r1 = new RegExp(/\$\{(?<var>[a-zA-Z0-9_ ]+?)\}/gm);
  const r2 = new RegExp(/\$(?<var>[a-zA-Z0-9_]+)/gm);

  const m1 = Array.from(input.matchAll(r1)).map((m) => m.groups?.var);
  const m2 = Array.from(input.matchAll(r2)).map((m) => m.groups?.var);

  return compact(uniq([...m1, ...m2]));
}

export const getOriginOfRefId = memoize(_getOriginsOfRefId, (refId, graph) => refId + fingerprintGraph(graph));
export const getDescendants = memoize(_getDescendants, (refId, graph) => refId + fingerprintGraph(graph));

export function _getOriginsOfRefId(refId: string, graph: Graph): string[] {
  const node = graph.getNode(refId);
  if (!node) {
    return [];
  }

  const origins: Node[] = [];

  // recurse through "node > inputEdges > inputNode"
  function findParentNode(node: Node) {
    const inputEdges = node.inputEdges;

    if (inputEdges.length > 0) {
      inputEdges.forEach((edge) => {
        if (edge.inputNode) {
          findParentNode(edge.inputNode);
        }
      });
    } else {
      origins.push(node);
    }
  }

  findParentNode(node);

  return origins.map((origin) => origin.name);
}

// get all children (and children's children etc) from a given node
export function _getDescendants(refId: string, graph: Graph): string[] {
  const node = graph.getNode(refId);
  if (!node) {
    return [];
  }

  const descendants: Node[] = [];

  // recurse through "node > outputEdges > outputNode"
  function findChildNode(node: Node) {
    const outputEdges = node.outputEdges;

    outputEdges.forEach((edge) => {
      if (edge.outputNode) {
        descendants.push(edge.outputNode);
        findChildNode(edge.outputNode);
      }
    });
  }

  findChildNode(node);

  return descendants.map((descendant) => descendant.name);
}

// create a unique fingerprint of the DAG
export function fingerprintGraph(graph: Graph) {
  return Object.keys(graph.nodes)
    .map((name) => {
      const n = graph.nodes[name];
      const outputEdges = n.outputEdges.map((e: Edge) => e.outputNode?.name).join(', ');
      const inputEdges = n.inputEdges.map((e: Edge) => e.inputNode?.name).join(', ');
      return `${n.name}:${outputEdges}:${inputEdges}`;
    })
    .join(' ');
}

// create a unique fingerprint of the array of queries
export function fingerPrintQueries(queries: AlertQuery[]) {
  return queries
    .map((query) => {
      const type = isExpressionQuery(query.model) ? query.model.type : query.queryType;
      return query.refId + (query.model.expression ?? '') + type;
    })
    .join();
}
