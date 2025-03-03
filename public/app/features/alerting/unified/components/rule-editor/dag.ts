import { compact, memoize, reject, uniq } from 'lodash';

import { Edge, Graph, Node } from 'app/core/utils/dag';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { ExpressionQuery, ExpressionQueryType } from 'app/features/expressions/types';
import { AlertQuery } from 'app/types/unified-alerting-dto';

/**
 * Turn the array of alert queries (this means data queries and expressions)
 * in to a DAG, a directed acyclical graph
 */
export function createDagFromQueries(queries: AlertQuery[]): Graph {
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

    // some expressions have multiple targets (like the math expression)
    const targets = getTargets(query.model);

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
    throw new DAGError('failed to create DAG from queries', { cause: linkErrors });
  }

  return graph;
}

/**
 * This function attempts to create a "clean" DAG where only the nodes that successfully link are left
 * ⚠️ This is a recursive function and very expensive for larger DAGs or large amount of queries
 */
export function createDAGFromQueriesSafe(
  queries: AlertQuery[],
  collectedLinkErrors: LinkError[] = []
): [Graph, LinkError[]] {
  try {
    return [createDagFromQueries(queries), collectedLinkErrors];
  } catch (error) {
    if (error instanceof DAGError) {
      const linkErrors = error.cause;
      collectedLinkErrors.push(...linkErrors);

      const updatedQueries = reject(queries, (query) =>
        linkErrors.some((linkError) => linkError.source === query.refId)
      );

      return createDAGFromQueriesSafe(updatedQueries, collectedLinkErrors);
    }
  }

  return [new Graph(), collectedLinkErrors];
}

export interface LinkError {
  source: string;
  target: string;
  error: unknown;
}

/** DAGError subclass, this is just a regular error but with LinkError[] as the cause */
export class DAGError extends Error {
  constructor(message: string, options: { cause: LinkError[] }) {
    super(message, options);
    this.cause = options?.cause ?? [];
  }

  cause: LinkError[];
}

export function getTargets(model: ExpressionQuery) {
  const isMathExpression = model.type === ExpressionQueryType.math;
  const isClassicCondition = model.type === ExpressionQueryType.classic;

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
