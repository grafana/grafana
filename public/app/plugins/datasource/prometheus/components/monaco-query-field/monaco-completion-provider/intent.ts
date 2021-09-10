import { parser } from 'lezer-promql';
import type { Tree, SyntaxNode } from 'lezer-tree';
import { NeverCaseError } from './util';

type Direction = 'parent' | 'firstChild' | 'lastChild';
type NodeTypeName =
  | '⚠' // this is used as error-name
  | 'AggregateExpr'
  | 'AggregateModifier'
  | 'FunctionCallBody'
  | 'GroupingLabels'
  | 'Identifier'
  | 'LabelMatcher'
  | 'LabelMatchers'
  | 'LabelMatchList'
  | 'LabelName'
  | 'MetricIdentifier'
  | 'PromQL'
  | 'StringLiteral'
  | 'VectorSelector'
  | 'MatrixSelector';

type Path = Array<[Direction, NodeTypeName]>;

function move(node: SyntaxNode, direction: Direction): SyntaxNode | null {
  switch (direction) {
    case 'parent':
      return node.parent;
    case 'firstChild':
      return node.firstChild;
    case 'lastChild':
      return node.lastChild;
    default:
      throw new NeverCaseError(direction);
  }
}

function walk(node: SyntaxNode, path: Path): SyntaxNode | null {
  let current: SyntaxNode | null = node;
  for (const [direction, expectedType] of path) {
    current = move(current, direction);
    if (current === null) {
      // we could not move in the direction, we stop
      return null;
    }
    if (current.type.name !== expectedType) {
      // the reached node has wrong type, we stop
      return null;
    }
  }
  return current;
}

function getNodeText(node: SyntaxNode, text: string): string {
  return text.slice(node.from, node.to);
}

function parsePromQLStringLiteral(text: string): string {
  // FIXME: support https://prometheus.io/docs/prometheus/latest/querying/basics/#string-literals
  // FIXME: maybe check other promql code, if all is supported or not
  // we start with double-quotes
  if (text.startsWith('"') && text.endsWith('"')) {
    if (text.indexOf('\\') !== -1) {
      throw new Error('FIXME: escape-sequences not supported in label-values');
    }
    return text.slice(1, text.length - 1);
  } else {
    throw new Error('FIXME: invalid string literal');
  }
}

export type Label = {
  name: string;
  value: string;
};

export type Intent =
  | {
      type: 'ALL_METRIC_NAMES';
    }
  | {
      type: 'FUNCTIONS_AND_ALL_METRIC_NAMES';
    }
  | {
      type: 'HISTORY_AND_FUNCTIONS_AND_ALL_METRIC_NAMES';
    }
  | {
      type: 'ALL_DURATIONS';
    }
  | {
      type: 'LABEL_NAMES_FOR_SELECTOR';
      metricName?: string;
      otherLabels: Label[];
    }
  | {
      type: 'LABEL_NAMES_FOR_BY';
      metricName: string;
      otherLabels: Label[];
    }
  | {
      type: 'LABEL_VALUES';
      metricName?: string;
      labelName: string;
      otherLabels: Label[];
    };

type Resolver = {
  path: NodeTypeName[];
  fun: (node: SyntaxNode, text: string, pos: number) => Intent | null;
};

function isPathMatch(resolverPath: string[], cursorPath: string[]): boolean {
  return resolverPath.every((item, index) => item === cursorPath[index]);
}

const ERROR_NODE_NAME: NodeTypeName = '⚠'; // this is used as error-name

const RESOLVERS: Resolver[] = [
  {
    path: ['LabelMatchers', 'VectorSelector'],
    fun: resolveLabelKeysWithEquals,
  },
  {
    path: ['PromQL'],
    fun: resolveTopLevel,
  },
  {
    path: ['FunctionCallBody'],
    fun: resolveInFunction,
  },
  {
    path: [ERROR_NODE_NAME, 'LabelMatcher'],
    fun: resolveLabelMatcherError,
  },
  {
    path: [ERROR_NODE_NAME, 'MatrixSelector'],
    fun: resolveDurations,
  },
  {
    path: ['GroupingLabels'],
    fun: resolveLabelsForGrouping,
  },
];

function getLabel(labelMatcherNode: SyntaxNode, text: string): Label | null {
  if (labelMatcherNode.type.name !== 'LabelMatcher') {
    return null;
  }

  const nameNode = walk(labelMatcherNode, [['firstChild', 'LabelName']]);

  if (nameNode === null) {
    return null;
  }

  const valueNode = walk(labelMatcherNode, [['lastChild', 'StringLiteral']]);

  if (valueNode === null) {
    return null;
  }

  const name = getNodeText(nameNode, text);
  const value = parsePromQLStringLiteral(getNodeText(valueNode, text));

  return { name, value };
}
function getLabels(labelMatchersNode: SyntaxNode, text: string): Label[] {
  if (labelMatchersNode.type.name !== 'LabelMatchers') {
    return [];
  }

  let listNode: SyntaxNode | null = walk(labelMatchersNode, [['firstChild', 'LabelMatchList']]);

  const labels: Label[] = [];

  while (listNode !== null) {
    const matcherNode = walk(listNode, [['lastChild', 'LabelMatcher']]);
    if (matcherNode === null) {
      // unexpected, we stop
      return [];
    }

    const label = getLabel(matcherNode, text);
    if (label !== null) {
      labels.push(label);
    }

    // there might be more labels
    listNode = walk(listNode, [['firstChild', 'LabelMatchList']]);
  }

  // our labels-list is last-first, so we reverse it
  labels.reverse();

  return labels;
}

function getNodeChildren(node: SyntaxNode): SyntaxNode[] {
  let child: SyntaxNode | null = node.firstChild;
  const children: SyntaxNode[] = [];
  while (child !== null) {
    children.push(child);
    child = child.nextSibling;
  }
  return children;
}

function getNodeInSubtree(node: SyntaxNode, typeName: NodeTypeName): SyntaxNode | null {
  // first we try the current node
  if (node.type.name === typeName) {
    return node;
  }

  // then we try the children
  const children = getNodeChildren(node);
  for (const child of children) {
    const n = getNodeInSubtree(child, typeName);
    if (n !== null) {
      return n;
    }
  }

  return null;
}

function resolveLabelsForGrouping(node: SyntaxNode, text: string, pos: number): Intent | null {
  const aggrExpNode = walk(node, [
    ['parent', 'AggregateModifier'],
    ['parent', 'AggregateExpr'],
  ]);
  if (aggrExpNode === null) {
    return null;
  }
  const bodyNode = aggrExpNode.getChild('FunctionCallBody');
  if (bodyNode === null) {
    return null;
  }

  const metricIdNode = getNodeInSubtree(bodyNode, 'MetricIdentifier');
  if (metricIdNode === null) {
    return null;
  }

  const idNode = walk(metricIdNode, [['firstChild', 'Identifier']]);
  if (idNode === null) {
    return null;
  }

  const metricName = getNodeText(idNode, text);
  return {
    type: 'LABEL_NAMES_FOR_BY',
    metricName,
    otherLabels: [],
  };
}

function resolveLabelMatcherError(node: SyntaxNode, text: string, pos: number): Intent | null {
  // we are probably in the scenario where the user is before entering the
  // label-value, like `{job=^}` (^ marks the cursor)
  const parent = walk(node, [['parent', 'LabelMatcher']]);
  if (parent === null) {
    return null;
  }

  const labelNameNode = walk(parent, [['firstChild', 'LabelName']]);
  if (labelNameNode === null) {
    return null;
  }

  const labelName = getNodeText(labelNameNode, text);

  // now we need to go up, to the parent of LabelMatcher,
  // there can be one or many `LabelMatchList` parents, we have
  // to go through all of them

  const firstListNode = walk(parent, [['parent', 'LabelMatchList']]);
  if (firstListNode === null) {
    return null;
  }

  let listNode = firstListNode;

  // we keep going through the parent-nodes
  // as long as they are LabelMatchList.
  // as soon as we reawch LabelMatchers, we stop
  let labelMatchersNode: SyntaxNode | null = null;
  while (labelMatchersNode === null) {
    const p = listNode.parent;
    if (p === null) {
      return null;
    }

    const { name } = p.type;

    switch (name) {
      case 'LabelMatchList':
        //we keep looping
        listNode = p;
        continue;
      case 'LabelMatchers':
        // we reached the end, we can stop the loop
        labelMatchersNode = p;
        continue;
      default:
        // we reached some other node, we stop
        return null;
    }
  }

  // now we need to find the other names
  const otherLabels = getLabels(labelMatchersNode, text);

  const metricNameNode = walk(labelMatchersNode, [
    ['parent', 'VectorSelector'],
    ['firstChild', 'MetricIdentifier'],
    ['firstChild', 'Identifier'],
  ]);

  if (metricNameNode === null) {
    // we are probably in a situation without a metric name
    return {
      type: 'LABEL_VALUES',
      labelName,
      otherLabels,
    };
  }

  const metricName = getNodeText(metricNameNode, text);

  return {
    type: 'LABEL_VALUES',
    metricName,
    labelName,
    otherLabels,
  };
}

function resolveTopLevel(node: SyntaxNode, text: string, pos: number): Intent {
  return {
    type: 'FUNCTIONS_AND_ALL_METRIC_NAMES',
  };
}

function resolveInFunction(node: SyntaxNode, text: string, pos: number): Intent {
  return {
    type: 'ALL_METRIC_NAMES',
  };
}

function resolveDurations(node: SyntaxNode, text: string, pos: number): Intent {
  return {
    type: 'ALL_DURATIONS',
  };
}

function resolveLabelKeysWithEquals(node: SyntaxNode, text: string, pos: number): Intent | null {
  const metricNameNode = walk(node, [
    ['parent', 'VectorSelector'],
    ['firstChild', 'MetricIdentifier'],
    ['firstChild', 'Identifier'],
  ]);

  const otherLabels = getLabels(node, text);

  if (metricNameNode === null) {
    // we are probably in a situation without a metric name.
    return {
      type: 'LABEL_NAMES_FOR_SELECTOR',
      otherLabels,
    };
  }

  const metricName = getNodeText(metricNameNode, text);

  return {
    type: 'LABEL_NAMES_FOR_SELECTOR',
    metricName,
    otherLabels,
  };
}

// we find the first error-node in the tree that is at the cursor-position.
// NOTE: this might be too slow, might need to optimize it
// (ideas: we do not need to go into every subtree, based on from/to)
// also, only go to places that are in the sub-tree of the node found
// by default by lezer. problem is, `next()` will go upward too,
// and we do not want to go higher than our node
function getErrorNode(tree: Tree, pos: number): SyntaxNode | null {
  const cur = tree.cursor(pos);
  while (true) {
    if (cur.from === pos && cur.to === pos) {
      const { node } = cur;
      if (node.type.isError) {
        return node;
      }
    }

    if (!cur.next()) {
      break;
    }
  }
  return null;
}

export function getIntent(text: string, pos: number): Intent | null {
  // there is a special-case when we are at the start of writing text,
  // so we handle that case first

  if (text === '') {
    return {
      type: 'HISTORY_AND_FUNCTIONS_AND_ALL_METRIC_NAMES',
    };
  }

  /*
	PromQL
Expr
VectorSelector
LabelMatchers
*/
  const tree = parser.parse(text);

  // if the tree contains error, it is very probable that
  // our node is one of those error-nodes.
  // also, if there are errors, the node lezer finds us,
  // might not be the best node.
  // so first we check if there is an error-node at the cursor-position
  const maybeErrorNode = getErrorNode(tree, pos);

  const cur = maybeErrorNode != null ? maybeErrorNode.cursor : tree.cursor(pos);
  const currentNode = cur.node;

  const names = [cur.name];
  while (cur.parent()) {
    names.push(cur.name);
  }

  for (let resolver of RESOLVERS) {
    // i do not use a foreach because i want to stop as soon
    // as i find something
    if (isPathMatch(resolver.path, names)) {
      return resolver.fun(currentNode, text, pos);
    }
  }

  return null;
}
