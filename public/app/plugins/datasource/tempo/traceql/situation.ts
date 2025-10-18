import { SyntaxNode, Tree } from '@lezer/common';

import {
  Aggregate,
  And,
  AttributeField,
  ComparisonOp,
  FieldExpression,
  FieldOp,
  GroupOperation,
  IntrinsicField,
  Or,
  parser,
  Pipe,
  ScalarFilter,
  SelectArgs,
  SelectOperation,
  SpansetFilter,
  SpansetPipeline,
  SpansetPipelineExpression,
  Static,
  String as StringNode,
  TraceQL,
} from '@grafana/lezer-traceql';

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
      type: 'SPANFIELD_COMBINING_OPERATORS';
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
    }
  | {
      type: 'SPANSET_PIPELINE_AFTER_OPERATOR';
    }
  | {
      type: 'SPANSET_IN_THE_MIDDLE';
    }
  | {
      type: 'SPANSET_EXPRESSION_OPERATORS_WITH_MISSING_CLOSED_BRACE';
    }
  | {
      type: 'NEW_SPANSET';
    }
  | {
      type: 'ATTRIBUTE_FOR_FUNCTION';
    }
  | {
      type: 'SPANSET_COMPARISON_OPERATORS';
    }
  | {
      type: 'QUERY_HINT_NAME';
    }
  | {
      type: 'QUERY_HINT_VALUE';
    };

type Path = Array<[Direction, NodeType[]]>;

type Resolver = {
  path: NodeType[];
  fun: (node: SyntaxNode, text: string, pos: number, originalPos: number) => SituationType | void;
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
  for (const [direction, expectedNodeIDs] of path) {
    current = move(current, direction);
    if (current === null) {
      // we could not move in the direction, we stop
      return null;
    }

    // note that the found value can be 0, which is acceptable
    if (expectedNodeIDs.find((id) => id === current?.type.id) === undefined) {
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
 * @param text the user input
 * @param offset the position of the cursor (starting from 0) in the user input
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

  // Check for with clause hint situations first
  const textUpToOffset = text.substring(0, offset);

  // Check if we're inside with(...) waiting for parameter names
  if (/\bwith\s*\(\s*$/.test(textUpToOffset)) {
    return {
      query: text,
      type: 'QUERY_HINT_NAME',
    };
  }

  // Check if we're after parameter= waiting for values
  if (/\bwith\s*\(\s*\w+\s*=\s*[\w]*$/.test(textUpToOffset)) {
    return {
      query: text,
      type: 'QUERY_HINT_VALUE',
    };
  }

  const tree = parser.parse(text);

  // Whitespaces (especially when multiple) on the left of the text cursor can trick the Lezer parser,
  // causing a wrong tree cursor to be picked.
  // Example: `{ span.foo =    ↓ }`, with `↓` being the cursor, tricks the parser.
  // Quick and dirty hack: Shift the cursor to the left until we find a non-whitespace character on its left.
  let shiftedOffset = offset;
  while (shiftedOffset - 1 >= 0 && text[shiftedOffset - 1] === ' ') {
    shiftedOffset -= 1;
  }

  // If the tree contains error, it's probable that our node is one of those error nodes.
  // If there are errors, the node lezer finds us might not be the best node.
  // So, first we check if there is an error node at the cursor position.
  let errorNode = getErrorNode(tree, shiftedOffset);
  if (!errorNode) {
    // Try again with the previous character.
    errorNode = getErrorNode(tree, shiftedOffset - 1);
  }
  if (!errorNode) {
    // Try again with the next character
    errorNode = getErrorNode(tree, shiftedOffset + 1);
  }

  const cur = errorNode != null ? errorNode.cursor() : tree.cursorAt(shiftedOffset);

  const currentNode = cur.node;
  const ids = [cur.type.id];
  while (cur.parent()) {
    ids.push(cur.type.id);
  }

  let situationType: SituationType | void = undefined;
  for (let resolver of RESOLVERS) {
    if (isPathMatch(resolver.path, ids)) {
      situationType = resolver.fun(currentNode, text, shiftedOffset, offset);
    }
  }

  return { query: text, ...(situationType ?? { type: 'UNKNOWN' }) };
}

const ERROR_NODE_ID = 0;

const RESOLVERS: Resolver[] = [
  // Curson on error node cases
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
    fun: resolveSpansetWithNoClosedBrace,
  },
  {
    path: [ERROR_NODE_ID, Aggregate],
    fun: resolveAttributeForFunction,
  },
  {
    path: [ERROR_NODE_ID, IntrinsicField],
    fun: resolveAttributeForFunction,
  },
  {
    path: [ERROR_NODE_ID, GroupOperation],
    fun: resolveAttributeForFunction,
  },
  {
    path: [ERROR_NODE_ID, SelectOperation],
    fun: resolveAttributeForFunction,
  },
  {
    path: [ERROR_NODE_ID, SpansetPipelineExpression],
    fun: resolveSpansetPipeline,
  },
  {
    path: [ERROR_NODE_ID, ScalarFilter, SpansetPipeline],
    fun: resolveArithmeticOperator,
  },
  // Curson on valid node cases (the whole query could contain errors nevertheless)
  {
    path: [FieldExpression],
    fun: resolveSpanset,
  },
  {
    path: [SpansetFilter],
    fun: resolveSpanset,
  },
  {
    path: [SpansetPipelineExpression],
    fun: resolveNewSpansetExpression,
  },
  {
    path: [TraceQL],
    fun: resolveNewSpansetExpression,
  },
  {
    path: [StringNode, Static],
    fun: resolveExpression,
  },
];

const resolveAttributeCompletion = (node: SyntaxNode, text: string, pos: number): SituationType | void => {
  // The user is completing an expression. We can take advantage of the fact that the Monaco editor is smart
  // enough to automatically detect that there are some characters before the cursor and to take them into
  // account when providing suggestions.
  const getAttributeFieldUpToDot = (node: SyntaxNode) => {
    const attributeFieldParent = walk(node, [['firstChild', [AttributeField]]]);
    const attributeFieldParentText = attributeFieldParent ? getNodeText(attributeFieldParent, text) : '';
    const indexOfDot = attributeFieldParentText.indexOf('.');
    return attributeFieldParentText.slice(0, indexOfDot);
  };

  // If there is a space, for sure the attribute is completed and no suggestions to complete it should be provided
  if (text[pos - 1] === ' ') {
    return;
  }

  const endOfPathNode = walk(node, [['firstChild', [FieldExpression]]]);
  if (endOfPathNode) {
    return {
      type: 'SPANSET_IN_NAME_SCOPE',
      scope: getAttributeFieldUpToDot(endOfPathNode),
    };
  }

  const endOfPathNode2 = walk(node, [
    ['parent', [SpansetFilter]],
    ['firstChild', [FieldExpression]],
  ]);
  // In this case, we also need to check the character at `pos`
  if (endOfPathNode2 && text[pos] !== ' ') {
    return {
      type: 'SPANSET_IN_NAME_SCOPE',
      scope: getAttributeFieldUpToDot(endOfPathNode2),
    };
  }
};

function resolveSpanset(node: SyntaxNode, text: string, _: number, originalPos: number): SituationType {
  const situation = resolveAttributeCompletion(node, text, originalPos);
  if (situation) {
    return situation;
  }

  let endOfPathNode = walk(node, [
    ['firstChild', [FieldExpression]],
    ['firstChild', [AttributeField]],
  ]);
  if (endOfPathNode) {
    return {
      type: 'SPANSET_EXPRESSION_OPERATORS',
    };
  }

  endOfPathNode = walk(node, [
    ['lastChild', [FieldExpression]],
    ['lastChild', [FieldExpression]],
    ['lastChild', [Static]],
  ]);
  if (endOfPathNode) {
    return {
      type: 'SPANFIELD_COMBINING_OPERATORS',
    };
  }

  endOfPathNode = walk(node, [['lastChild', [FieldExpression]]]);
  if (endOfPathNode) {
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

  if (
    ['event', 'instrumentation', 'link', 'resource', 'span', 'parent'].find((item) => item === attributeFieldUpToDot)
  ) {
    return {
      type: 'SPANSET_IN_NAME_SCOPE',
      scope: attributeFieldUpToDot,
    };
  }
  return {
    type: 'SPANSET_IN_NAME',
  };
}

function resolveExpression(node: SyntaxNode, text: string, _: number, originalPos: number): SituationType {
  const situation = resolveAttributeCompletion(node, text, originalPos);
  if (situation) {
    return situation;
  }

  if (
    walk(node, [
      ['parent', [Static]],
      ['parent', [FieldExpression]],
      ['prevSibling', [FieldOp]],
    ])
  ) {
    let attributeField = node.parent?.parent?.prevSibling?.prevSibling;
    if (attributeField) {
      return {
        type: 'SPANSET_IN_VALUE',
        tagName: getNodeText(attributeField, text),
        betweenQuotes: true,
      };
    }
  }

  if (node.prevSibling?.type.id === FieldOp) {
    let attributeField = node.prevSibling?.prevSibling;
    if (attributeField) {
      return {
        type: 'SPANSET_IN_VALUE',
        tagName: getNodeText(attributeField, text),
        betweenQuotes: false,
      };
    }
  }

  if (node.prevSibling?.type.name === 'And' || node.prevSibling?.type.name === 'Or') {
    return {
      type: 'SPANSET_EMPTY',
    };
  }

  return {
    type: 'SPANSET_IN_THE_MIDDLE',
  };
}

function resolveArithmeticOperator(node: SyntaxNode, _0: string, _1: number): SituationType | void {
  if (node.prevSibling?.type.id !== ComparisonOp) {
    return {
      type: 'SPANSET_COMPARISON_OPERATORS',
    };
  }
}

function resolveNewSpansetExpression(node: SyntaxNode, text: string, offset: number): SituationType {
  // Select the node immediately before the one pointed by the cursor
  let previousNode = node.firstChild;
  try {
    previousNode = node.firstChild;
    while (previousNode!.to < offset) {
      previousNode = previousNode!.nextSibling;
    }
  } catch (error) {
    console.error('Unexpected error while searching for previous node', error);
  }

  if (previousNode?.type.id === And || previousNode?.type.id === Or) {
    return {
      type: 'NEW_SPANSET',
    };
  }

  return {
    type: 'SPANSET_COMBINING_OPERATORS',
  };
}

function resolveAttributeForFunction(node: SyntaxNode, _0: string, _1: number): SituationType | void {
  const parent = node?.parent;
  if (!!parent && [IntrinsicField, Aggregate, GroupOperation, SelectOperation, SelectArgs].includes(parent.type.id)) {
    return {
      type: 'ATTRIBUTE_FOR_FUNCTION',
    };
  }
}

function resolveSpansetPipeline(node: SyntaxNode, _1: string, _2: number): SituationType {
  if (node.prevSibling?.type.id === Pipe) {
    return {
      type: 'SPANSET_PIPELINE_AFTER_OPERATOR',
    };
  }
  return {
    type: 'NEW_SPANSET',
  };
}

function resolveSpansetWithNoClosedBrace(node: SyntaxNode, text: string, originalPos: number): SituationType {
  const situation = resolveAttributeCompletion(node, text, originalPos);
  if (situation) {
    return situation;
  }

  return {
    type: 'SPANSET_EXPRESSION_OPERATORS_WITH_MISSING_CLOSED_BRACE',
  };
}
