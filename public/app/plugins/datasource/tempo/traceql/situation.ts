import { SyntaxNode, Tree } from '@lezer/common';

import { AttributeField, FieldExpression, FieldOp, parser, SpansetFilter, TraceQL } from '@grafana/lezer-traceql';

type Direction = 'parent' | 'firstChild' | 'lastChild' | 'nextSibling' | 'prevSibling';
type NodeType = number;

export type Situation = { query: string } & SituationType;

export type SituationType =
  | {
      type: 'UNKNOWN';
    }
  | {
      type: 'EMPTY';
    }
  | {
      type: 'SPANSET_EMPTY';
    }
  | {
      type: 'SPANSET_ONLY_DOT';
    }
  | {
      type: 'SPANSET_EXPRESSION_OPERATORS';
    }
  | {
      type: 'SPANSET_IN_NAME';
    }
  | {
      type: 'SPANSET_IN_NAME_SCOPE';
      scope: string;
    }
  | {
      type: 'SPANSET_IN_VALUE';
      tagName: string;
      betweenQuotes: boolean;
    }
  | {
      type: 'SPANSET_AFTER_VALUE';
    }
  | {
      type: 'SPANSET_COMBINING_OPERATORS';
    };

type Path = Array<[Direction, NodeType[]]>;

type Resolver = {
  path: NodeType[];
  fun: (node: SyntaxNode, text: string, pos: number) => SituationType | null;
};

function getErrorNode(tree: Tree, cursorPos: number): SyntaxNode | null {
  const cur = tree.cursorAt(cursorPos);
  do {
    if (cur.from === cursorPos || cur.to === cursorPos) {
      const { node } = cur;
      if (node.type.isError) {
        return node;
      }
    }
  } while (cur.next());
  return null;
}

function move(node: SyntaxNode, direction: Direction): SyntaxNode | null {
  return node[direction];
}

function walk(node: SyntaxNode, path: Path): SyntaxNode | null {
  let current: SyntaxNode | null = node;
  for (const [direction, expectedNodes] of path) {
    current = move(current, direction);
    if (current === null) {
      // we could not move in the direction, we stop
      return null;
    }
    if (!expectedNodes.find((en) => en === current?.type.id)) {
      // the reached node has wrong type, we stop
      return null;
    }
  }
  return current;
}

function getNodeText(node: SyntaxNode, text: string): string {
  // if the from and to are them same (e.g. for an error node) we can subtract 1 from the start/from index
  return text.slice(node.from === node.to ? node.from - 1 : node.from, node.to);
}

function isPathMatch(resolverPath: NodeType[], cursorPath: number[]): boolean {
  return resolverPath.every((item, index) => item === cursorPath[index]);
}

/**
 * Figure out where is the cursor and what kind of suggestions are appropriate.
 * @param text
 * @param offset
 */
export function getSituation(text: string, offset: number): Situation | null {
  // there is a special case when we are at the start of writing text,
  // so we handle that case first
  if (text === '') {
    return {
      query: text,
      type: 'EMPTY',
    };
  }

  const tree = parser.parse(text);

  // if the tree contains error, it is very probable that
  // our node is one of those error nodes.
  // also, if there are errors, the node lezer finds us,
  // might not be the best node.
  // so first we check if there is an error node at the cursor position
  let maybeErrorNode = getErrorNode(tree, offset);
  if (!maybeErrorNode) {
    // try again with the previous character
    maybeErrorNode = getErrorNode(tree, offset - 1);
  }

  const cur = maybeErrorNode != null ? maybeErrorNode.cursor() : tree.cursorAt(offset);

  const currentNode = cur.node;

  const ids = [cur.type.id];
  while (cur.parent()) {
    ids.push(cur.type.id);
  }

  let situationType: SituationType | null = null;
  for (let resolver of RESOLVERS) {
    if (isPathMatch(resolver.path, ids)) {
      situationType = resolver.fun(currentNode, text, offset);
    }
  }

  return { query: text, ...(situationType ?? { type: 'UNKNOWN' }) };
}

const ERROR_NODE_ID = 0;

const RESOLVERS: Resolver[] = [
  {
    path: [ERROR_NODE_ID, AttributeField],
    fun: resolveAttribute,
  },
  {
    path: [ERROR_NODE_ID, FieldExpression],
    fun: resolveExpression,
  },
  {
    path: [ERROR_NODE_ID, SpansetFilter],
    fun: resolveErrorInFilterRoot,
  },
  {
    path: [SpansetFilter],
    fun: resolveSpanset,
  },
  {
    path: [TraceQL],
    fun: () => {
      return {
        type: 'SPANSET_COMBINING_OPERATORS',
      };
    },
  },
];

function resolveSpanset(node: SyntaxNode): SituationType {
  const lastFieldExpression = walk(node, [['lastChild', [FieldExpression]]]);
  if (lastFieldExpression) {
    return {
      type: 'SPANSET_EXPRESSION_OPERATORS',
    };
  }

  return {
    type: 'SPANSET_EMPTY',
  };
}

function resolveAttribute(node: SyntaxNode, text: string): SituationType {
  const attributeFieldParent = walk(node, [['parent', [AttributeField]]]);
  const attributeFieldParentText = attributeFieldParent ? getNodeText(attributeFieldParent, text) : '';

  if (attributeFieldParentText === '.') {
    return {
      type: 'SPANSET_ONLY_DOT',
    };
  }

  const indexOfDot = attributeFieldParentText.indexOf('.');
  const attributeFieldUpToDot = attributeFieldParentText.slice(0, indexOfDot);

  if (['span', 'resource', 'parent'].find((item) => item === attributeFieldUpToDot)) {
    return {
      type: 'SPANSET_IN_NAME_SCOPE',
      scope: attributeFieldUpToDot,
    };
  }
  return {
    type: 'SPANSET_IN_NAME',
  };
}

function resolveExpression(node: SyntaxNode, text: string): SituationType {
  if (node.prevSibling?.type.id === FieldOp) {
    let attributeField = node.prevSibling.prevSibling;
    if (attributeField) {
      return {
        type: 'SPANSET_IN_VALUE',
        tagName: getNodeText(attributeField, text),
        betweenQuotes: false,
      };
    }
  }
  return {
    type: 'SPANSET_EMPTY',
  };
}

function resolveErrorInFilterRoot(): SituationType {
  return {
    type: 'SPANSET_IN_NAME',
  };
}
