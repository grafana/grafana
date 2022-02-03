import { parser } from 'lezer-promql';
import { SyntaxNode, TreeCursor } from 'lezer-tree';
import { QueryBuilderLabelFilter, QueryBuilderOperation } from './shared/types';
import { PromVisualQuery } from './types';

/**
 * Parses a PromQL query into a visual query model.
 *
 * It traverses the tree and uses sort of state machine to update update the query model. The query model is modified
 * during the traversal and sent to each handler as context.
 * Right now this can handle interval variables but no others or errors.
 *
 * TODO: deal with incomplete query, errors and template variables
 * @param expr
 */
export function buildVisualQueryFromString(expr: string): PromVisualQuery {
  const tree = parser.parse(expr);
  const node = tree.topNode;

  // This will be modified in the handlers.
  const visQuery: PromVisualQuery = {
    metric: '',
    labels: [],
    operations: [],
  };

  handleExpression(expr, node, visQuery);
  return visQuery;
}

/**
 * Handler for default state. It will traverse the tree and call the appropriate handler for each node. The node
 * handled here does not necessarily needs to be of type == Expr.
 * @param expr
 * @param node
 * @param visQuery
 */
export function handleExpression(expr: string, node: SyntaxNode, visQuery: PromVisualQuery) {
  switch (node.name) {
    case 'MetricIdentifier': {
      // Expectation is that there is only one of those per query.
      visQuery.metric = getString(expr, node);
      break;
    }

    case 'LabelMatcher': {
      // Same as MetricIdentifier should be just one per query.
      visQuery.labels.push(getLabel(expr, node));
      break;
    }

    case 'FunctionCall': {
      handleFunction(expr, node, visQuery);
      break;
    }

    case 'AggregateExpr': {
      handleAggregation(expr, node, visQuery);
      break;
    }

    case 'BinaryExpr': {
      handleBinary(expr, node, visQuery);
      break;
    }

    default: {
      // Any other nodes we just ignore and go to it's children. This should be fine as there are lot's of wrapper
      // nodes that can be skipped.
      // TODO: there are probably cases where we will just skip nodes we don't support and we should be able to
      //  detect those and report back.
      let child = node.firstChild;
      while (child) {
        handleExpression(expr, child, visQuery);
        child = child.nextSibling;
      }
    }
  }
}

function getLabel(expr: string, node: SyntaxNode): QueryBuilderLabelFilter {
  const label = getString(expr, node.getChild('LabelName'));
  const op = getString(expr, node.getChild('MatchOp'));
  const value = getString(expr, node.getChild('StringLiteral')).replace(/"/g, '');
  return {
    label,
    op,
    value,
  };
}

const rangeFunctions = ['changes', 'rate', 'irate', 'increase', 'delta'];
/**
 * Handle function call which is usually and identifier and its body > arguments.
 * @param expr
 * @param node
 * @param visQuery
 */
function handleFunction(expr: string, node: SyntaxNode, visQuery: PromVisualQuery) {
  const nameNode = node.getChild('FunctionIdentifier');
  const funcName = getString(expr, nameNode);

  const body = node.getChild('FunctionCallBody');
  const callArgs = body!.getChild('FunctionCallArgs');
  const params = [];

  // This is a bit of a shortcut to get the interval argument. Reasons are
  // - interval is not part of the function args per promQL grammar but we model it as argument for the function in
  //   the query model.
  // - it is easier to handle template variables this way as template variable is an error for the parser
  if (rangeFunctions.includes(funcName) || funcName.endsWith('_over_time')) {
    let match = getString(expr, node).match(/\[([\$_\w]+)\]/);
    if (match?.[1]) {
      params.push(match[1]);
    }
  }

  const op = { id: funcName, params };
  // We unshift operations to keep the more natural order that we want to have in the visual query editor.
  visQuery.operations.unshift(op);
  updateFunctionArgs(expr, callArgs!, visQuery, op);
}

/**
 * Handle aggregation as they are distinct type from other functions.
 * @param expr
 * @param node
 * @param visQuery
 */
function handleAggregation(expr: string, node: SyntaxNode, visQuery: PromVisualQuery) {
  const nameNode = node.getChild('AggregateOp');
  let funcName = getString(expr, nameNode);

  const modifier = node.getChild('AggregateModifier');
  const labels = [];

  // TODO: support also Without modifier (but we don't support it in visual query yet)
  if (modifier) {
    const byModifier = modifier.getChild(`By`);
    if (byModifier && funcName) {
      funcName = `__${funcName}_by`;
    }
    labels.push(...getAllByType(expr, modifier, 'GroupingLabel'));
  }

  const body = node.getChild('FunctionCallBody');
  const callArgs = body!.getChild('FunctionCallArgs');

  const op: QueryBuilderOperation = { id: funcName, params: [] };
  visQuery.operations.unshift(op);
  updateFunctionArgs(expr, callArgs!, visQuery, op);
  // We add labels after params in the visual query editor.
  op.params.push(...labels);
}

/**
 * Handle (probably) all types of arguments that function or aggregation can have.
 *
 *  FunctionCallArgs are nested bit weirdly basically its [firstArg, ...rest] where rest is again FunctionCallArgs so
 *  we cannot just get all the children and iterate them as arguments we have to again recursively traverse through
 *  them.
 *
 * @param expr
 * @param node
 * @param visQuery
 * @param op - We need the operation to add the params to as an additional context.
 */
function updateFunctionArgs(expr: string, node: SyntaxNode, visQuery: PromVisualQuery, op: QueryBuilderOperation) {
  switch (node.name) {
    // In case we have an expression we don't know what kind so we have to look at the child as it can be anything.
    case 'Expr':
    // FunctionCallArgs are nested bit weirdly as mentioned so we have to go one deeper in this case.
    case 'FunctionCallArgs': {
      let child = node.firstChild;
      while (child) {
        updateFunctionArgs(expr, child, visQuery, op);
        child = child.nextSibling;
      }
      break;
    }

    case 'NumberLiteral': {
      op.params.push(parseInt(getString(expr, node), 10));
      break;
    }

    case 'StringLiteral': {
      op.params.push(getString(expr, node).replace(/"/g, ''));
      break;
    }

    default: {
      // Means we get to something that does not seem like simple function arg and is probably nested query so jump
      // back to main context
      handleExpression(expr, node, visQuery);
    }
  }
}

const operatorToOpName: Record<string, string> = {
  '/': '__divide_by',
  '*': '__multiply_by',
};

/**
 * Right now binary expressions can be represented in 2 way in visual query. As additional operation in case it is
 * just operation with scalar or it creates a binaryQuery when it's 2 queries.
 * @param expr
 * @param node
 * @param visQuery
 */
function handleBinary(expr: string, node: SyntaxNode, visQuery: PromVisualQuery) {
  const left = node.firstChild!;
  const op = getString(expr, left.nextSibling);
  const right = node.lastChild!;

  const opName = operatorToOpName[op];

  const leftNumber = left.getChild('NumberLiteral');
  const rightNumber = right.getChild('NumberLiteral');

  if (leftNumber || rightNumber) {
    // Scalar case, just add operation.
    const [num, query] = leftNumber ? [leftNumber, right] : [rightNumber, left];
    visQuery.operations.push({ id: opName, params: [parseInt(getString(expr, num), 10)] });
    handleExpression(expr, query, visQuery);
  } else {
    // Two queries case so we create a binary query.
    visQuery.binaryQueries = visQuery.binaryQueries || [];
    const binQuery = {
      operator: op,
      query: {
        metric: '',
        labels: [],
        operations: [],
      },
    };
    visQuery.binaryQueries.push(binQuery);
    // One query is the main query, second is wrapped in the binaryQuery wrapper.
    handleExpression(expr, left, visQuery);
    handleExpression(expr, right, binQuery.query);
  }
}

/**
 * Get the actual string of the expression. That is not stored in the tree so we have to get the indexes from the node
 * and then based on that get it from the expression.
 * @param expr
 * @param cur
 */
function getString(expr: string, cur: TreeCursor | SyntaxNode | null) {
  if (!cur) {
    return '';
  }
  return expr.substring(cur.from, cur.to);
}

/**
 * Get all nodes with type in the tree. This traverses the tree so it is safe only when you know there shouldn't be
 * too much nesting but you just want to skip some of the wrappers. For example getting function args this way would
 * not be safe is it would also find arguments of nested functions.
 * @param expr
 * @param cur
 * @param type
 */
function getAllByType(expr: string, cur: SyntaxNode, type: string): string[] {
  if (cur.name === type) {
    return [getString(expr, cur)];
  }
  const values: string[] = [];
  let pos = 0;
  let child = cur.childAfter(pos);
  while (child) {
    values.push(...getAllByType(expr, child, type));
    pos = child.to;
    child = cur.childAfter(pos);
  }
  return values;
}

// Debugging function for convenience.
function log(expr: string, cur?: SyntaxNode) {
  const json = toJson(expr, cur);
  if (!json) {
    console.log('<empty>');
    return;
  }
  console.log(JSON.stringify(json, undefined, 2));
}

function toJson(expr: string, cur?: SyntaxNode) {
  if (!cur) {
    return undefined;
  }
  const treeJson: any = {};
  const name = nodeToString(expr, cur);
  const children = [];

  let pos = 0;
  let child = cur.childAfter(pos);
  while (child) {
    children.push(toJson(expr, child));
    pos = child.to;
    child = cur.childAfter(pos);
  }

  treeJson[name] = children;
  return treeJson;
}

function nodeToString(expr: string, node: SyntaxNode) {
  return node.name + ':' + getString(expr, node);
}
