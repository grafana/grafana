import { compact, memoize, uniq } from 'lodash';
import memoizeOne from 'memoize-one';

import { Edge, Graph, Node } from 'app/core/utils/dag';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { ExpressionQuery } from 'app/features/expressions/types';
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

  const nodes = queries.map((query) => query.refId);
  graph.createNodes(nodes);

  queries.forEach((query) => {
    if (!isExpressionQuery(query.model)) {
      return;
    }
    const source = query.refId;

    // some expressions have multiple targets (like the math expression)
    const targets = getTargets(query.model);

    targets.forEach((target) => {
      const isSelf = source === target;

      if (source && target && !isSelf) {
        graph.link(target, source);
      }
    });
  });

  return graph;
}

function getTargets(model: ExpressionQuery) {
  const isMathExpression = model.type === 'math';
  const isClassicCondition = model.type === 'classic_conditions';

  if (isMathExpression) {
    return parseRefsFromMathExpression(model.expression ?? '');
  }
  if (isClassicCondition) {
    return model.conditions?.map((c) => c.query.params[0]) ?? [];
  }
  return [model.expression];
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
