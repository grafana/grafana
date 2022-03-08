import { parser } from '@grafana/lezer-logql';
import type { Tree, SyntaxNode } from '@lezer/common';
import { NeverCaseError } from './util';

type Direction = 'parent' | 'firstChild' | 'lastChild' | 'nextSibling';
type NodeTypeName =
  | '⚠' // this is used as error-name
  | 'VectorAggregationExpr'
  | 'Grouping'
  | 'RangeAggregationExpr'
  | 'Labels'
  | 'Identifier'
  | 'Matcher'
  | 'Matchers'
  | 'Selector'
  | 'LabelName'
  | 'PromQL'
  | 'String'
  | 'VectorSelector'
  | 'MatrixSelector'
  | 'MatchOp'
  | 'EqlSingle'
  | 'Neq'
  | 'EqlRegex'
  | 'NeqRegex'
  | 'EqlSingle'
  | 'EqlRegex'
  | 'Neq'
  | 'NeqRegex';

type Path = Array<[Direction, NodeTypeName]>;

function move(node: SyntaxNode, direction: Direction): SyntaxNode | null {
  switch (direction) {
    case 'parent':
      return node.parent;
    case 'firstChild':
      return node.firstChild;
    case 'lastChild':
      return node.lastChild;
    case 'nextSibling':
      return node.nextSibling;
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
  // if it is a string-literal, it is inside quotes of some kind
  const inside = text.slice(1, text.length - 1);

  // FIXME: support https://prometheus.io/docs/prometheus/latest/querying/basics/#string-literals
  // FIXME: maybe check other promql code, if all is supported or not

  // for now we do only some very simple un-escaping

  // we start with double-quotes
  if (text.startsWith('"') && text.endsWith('"')) {
    // NOTE: this is not 100% perfect, we only unescape the double-quote,
    // there might be other characters too
    return inside.replace(/\\"/, '"');
  }

  // then single-quote
  if (text.startsWith("'") && text.endsWith("'")) {
    // NOTE: this is not 100% perfect, we only unescape the single-quote,
    // there might be other characters too
    return inside.replace(/\\'/, "'");
  }

  // then backticks
  if (text.startsWith('`') && text.endsWith('`')) {
    return inside;
  }

  throw new Error('FIXME: invalid string literal');
}

export type LabelOperator = '=' | '!=' | '=~' | '!~';

export type Label = {
  name: string;
  value: string;
  op: LabelOperator;
};

export type Situation =
  | {
      type: 'IN_FUNCTION';
    }
  | {
      type: 'AT_ROOT';
    }
  | {
      type: 'EMPTY';
    }
  | {
      type: 'IN_DURATION';
    }
  | {
      type: 'IN_LABEL_SELECTOR_NO_LABEL_NAME';
      otherLabels: Label[];
    }
  | {
      type: 'IN_LABEL_SELECTOR_WITH_LABEL_NAME';
      labelName: string;
      betweenQuotes: boolean;
      otherLabels: Label[];
    };

type Resolver = {
  path: NodeTypeName[];
  fun: (node: SyntaxNode, text: string, pos: number) => Situation | null;
};

function isPathMatch(resolverPath: string[], cursorPath: string[]): boolean {
  return resolverPath.every((item, index) => item === cursorPath[index]);
}

const ERROR_NODE_NAME: NodeTypeName = '⚠'; // this is used as error-name

const RESOLVERS: Resolver[] = [
  {
    path: ['Selector'],
    fun: resolveSelector,
  },
  {
    path: ['PromQL'],
    fun: resolveTopLevel,
  },
  {
    path: ['RangeAggregationExpr'],
    fun: resolveInFunction,
  },
  {
    path: ['String', 'Matcher'],
    fun: resolveLabelMatcher,
  },
  {
    path: [ERROR_NODE_NAME, 'Matcher'],
    fun: resolveLabelMatcher,
  },
  {
    path: [ERROR_NODE_NAME, 'MatrixSelector'],
    fun: resolveDurations,
  },
];

const LABEL_OP_MAP = new Map<string, LabelOperator>([
  ['Eq', '='],
  ['Re', '=~'],
  ['Neq', '!='],
  ['Nre', '!~'],
]);

function getLabelOp(opNode: SyntaxNode): LabelOperator | null {
  return LABEL_OP_MAP.get(opNode.name) ?? null;
}

function getLabel(labelMatcherNode: SyntaxNode, text: string): Label | null {
  if (labelMatcherNode.type.name !== 'Matcher') {
    return null;
  }

  const nameNode = walk(labelMatcherNode, [['firstChild', 'Identifier']]);

  if (nameNode === null) {
    return null;
  }

  const opNode = nameNode.nextSibling;
  if (opNode === null) {
    return null;
  }

  const op = getLabelOp(opNode);
  if (op === null) {
    return null;
  }

  const valueNode = walk(labelMatcherNode, [['lastChild', 'String']]);

  if (valueNode === null) {
    return null;
  }

  const name = getNodeText(nameNode, text);
  const value = parsePromQLStringLiteral(getNodeText(valueNode, text));

  return { name, value, op };
}
function getLabels(selectorNode: SyntaxNode, text: string): Label[] {
  if (selectorNode.type.name !== 'Selector') {
    return [];
  }

  let listNode: SyntaxNode | null = walk(selectorNode, [['firstChild', 'Matchers']]);

  const labels: Label[] = [];

  while (listNode !== null) {
    const matcherNode = walk(listNode, [['lastChild', 'Matcher']]);
    if (matcherNode === null) {
      // unexpected, we stop
      return [];
    }

    const label = getLabel(matcherNode, text);
    if (label !== null) {
      labels.push(label);
    }

    // there might be more labels
    listNode = walk(listNode, [['firstChild', 'Matchers']]);
  }

  // our labels-list is last-first, so we reverse it
  labels.reverse();

  return labels;
}

// function getNodeChildren(node: SyntaxNode): SyntaxNode[] {
//   let child: SyntaxNode | null = node.firstChild;
//   const children: SyntaxNode[] = [];
//   while (child !== null) {
//     children.push(child);
//     child = child.nextSibling;
//   }
//   return children;
// }

// function getNodeInSubtree(node: SyntaxNode, typeName: NodeTypeName): SyntaxNode | null {
//   // first we try the current node
//   if (node.type.name === typeName) {
//     return node;
//   }

//   // then we try the children
//   const children = getNodeChildren(node);
//   for (const child of children) {
//     const n = getNodeInSubtree(child, typeName);
//     if (n !== null) {
//       return n;
//     }
//   }

//   return null;
// }

function resolveLabelMatcher(node: SyntaxNode, text: string, pos: number): Situation | null {
  // we can arrive here in two situation. `node` is either:
  // - a StringNode (like in `{job="^"}`)
  // - or an error node (like in `{job=^}`)
  const inStringNode = !node.type.isError;

  const parent = walk(node, [['parent', 'Matcher']]);
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

  const firstListNode = walk(parent, [['parent', 'Selector']]);
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
  const allLabels = getLabels(labelMatchersNode, text);

  // we need to remove "our" label from all-labels, if it is in there
  const otherLabels = allLabels.filter((label) => label.name !== labelName);

  return {
    type: 'IN_LABEL_SELECTOR_WITH_LABEL_NAME',
    labelName,
    betweenQuotes: inStringNode,
    otherLabels,
  };
}

function resolveTopLevel(node: SyntaxNode, text: string, pos: number): Situation {
  return {
    type: 'AT_ROOT',
  };
}

function resolveInFunction(node: SyntaxNode, text: string, pos: number): Situation {
  return {
    type: 'IN_FUNCTION',
  };
}

function resolveDurations(node: SyntaxNode, text: string, pos: number): Situation {
  return {
    type: 'IN_DURATION',
  };
}

// function subTreeHasError(node: SyntaxNode): boolean {
//   return getNodeInSubtree(node, ERROR_NODE_NAME) !== null;
// }

function resolveSelector(node: SyntaxNode, text: string, pos: number): Situation | null {
  // for example `{^}`

  // there are some false positives that can end up in this situation, that we want

  // next false positive:
  // `{a="1"^}`
  const child = walk(node, [['firstChild', 'Matchers']]);
  if (child !== null) {
    // means the label-matching part contains at least one label already.
    //
    // in this case, we will need to have a `,` character at the end,
    // to be able to suggest adding the next label.
    // the area between the end-of-the-child-node and the cursor-pos
    // must contain a `,` in this case.
    const textToCheck = text.slice(child.to, pos);

    if (!textToCheck.includes(',')) {
      return null;
    }
  }

  const otherLabels = getLabels(node, text);

  return {
    type: 'IN_LABEL_SELECTOR_NO_LABEL_NAME',
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

export function getSituation(text: string, pos: number): Situation | null {
  // there is a special-case when we are at the start of writing text,
  // so we handle that case first

  if (text === '') {
    return {
      type: 'EMPTY',
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
