import { parser } from 'lezer-promql';
import { SyntaxNode, TreeCursor } from '@lezer/common';
import { QueryBuilderLabelFilter, QueryBuilderOperation } from './shared/types';
import { PromVisualQuery } from './types';
import { binaryScalarDefs } from './binaryScalarOperations';

// Taken from template_srv, but copied so to not mess with the regex.index which is manipulated in the service
/*
 * This regex matches 3 types of variable reference with an optional format specifier
 * \$(\w+)                          $var1
 * \[\[([\s\S]+?)(?::(\w+))?\]\]    [[var2]] or [[var2:fmt2]]
 * \${(\w+)(?::(\w+))?}             ${var3} or ${var3:fmt3}
 */
const variableRegex = /\$(\w+)|\[\[([\s\S]+?)(?::(\w+))?\]\]|\${(\w+)(?:\.([^:^\}]+))?(?::([^\}]+))?}/g;

/**
 * As variables with $ are creating parsing errors, we first replace them with magic string that is parseable and at
 * the same time we can get the variable and it's format back from it.
 * @param expr
 */
function replaceVariables(expr: string) {
  return expr.replace(variableRegex, (match, var1, var2, fmt2, var3, fieldPath, fmt3) => {
    const fmt = fmt2 || fmt3;
    let variable = var1;
    let varType = '0';

    if (var2) {
      variable = var2;
      varType = '1';
    }

    if (var3) {
      variable = var3;
      varType = '2';
    }

    return `__V_${varType}__` + variable + '__V__' + (fmt ? '__F__' + fmt + '__F__' : '');
  });
}

const varTypeFunc = [
  (v: string, f?: string) => `\$${v}`,
  (v: string, f?: string) => `[[${v}${f ? `:${f}` : ''}]]`,
  (v: string, f?: string) => `\$\{${v}${f ? `:${f}` : ''}\}`,
];

/**
 * Get beck the text with variables in their original format.
 * @param expr
 */
function returnVariables(expr: string) {
  return expr.replace(/__V_(\d)__(.+)__V__(?:__F__(\w+)__F__)?/g, (match, type, v, f) => {
    return varTypeFunc[parseInt(type, 10)](v, f);
  });
}

/**
 * Parses a PromQL query into a visual query model.
 *
 * It traverses the tree and uses sort of state machine to update the query model. The query model is modified
 * during the traversal and sent to each handler as context.
 *
 * @param expr
 */
export function buildVisualQueryFromString(expr: string): Context {
  const replacedExpr = replaceVariables(expr);
  const tree = parser.parse(replacedExpr);
  const node = tree.topNode;

  // This will be modified in the handlers.
  const visQuery: PromVisualQuery = {
    metric: '',
    labels: [],
    operations: [],
  };
  const context: Context = {
    query: visQuery,
    errors: [],
  };

  try {
    handleExpression(replacedExpr, node, context);
  } catch (err) {
    // Not ideal to log it here, but otherwise we would lose the stack trace.
    console.error(err);
    context.errors.push({
      text: err.message,
    });
  }
  return context;
}

interface ParsingError {
  text: string;
  from?: number;
  to?: number;
  parentType?: string;
}

interface Context {
  query: PromVisualQuery;
  errors: ParsingError[];
}

// This is used for error type for some reason
const ErrorName = '⚠';

/**
 * Handler for default state. It will traverse the tree and call the appropriate handler for each node. The node
 * handled here does not necessarily need to be of type == Expr.
 * @param expr
 * @param node
 * @param context
 */
export function handleExpression(expr: string, node: SyntaxNode, context: Context) {
  const visQuery = context.query;
  switch (node.name) {
    case 'MetricIdentifier': {
      // Expectation is that there is only one of those per query.
      visQuery.metric = getString(expr, node);
      break;
    }

    case 'LabelMatcher': {
      // Same as MetricIdentifier should be just one per query.
      visQuery.labels.push(getLabel(expr, node));
      const err = node.getChild(ErrorName);
      if (err) {
        context.errors.push(makeError(expr, err));
      }
      break;
    }

    case 'FunctionCall': {
      handleFunction(expr, node, context);
      break;
    }

    case 'AggregateExpr': {
      handleAggregation(expr, node, context);
      break;
    }

    case 'BinaryExpr': {
      handleBinary(expr, node, context);
      break;
    }

    case ErrorName: {
      if (isIntervalVariableError(node)) {
        break;
      }
      context.errors.push(makeError(expr, node));
      break;
    }

    default: {
      // Any other nodes we just ignore and go to it's children. This should be fine as there are lot's of wrapper
      // nodes that can be skipped.
      // TODO: there are probably cases where we will just skip nodes we don't support and we should be able to
      //  detect those and report back.
      let child = node.firstChild;
      while (child) {
        handleExpression(expr, child, context);
        child = child.nextSibling;
      }
    }
  }
}

function makeError(expr: string, node: SyntaxNode) {
  return {
    text: getString(expr, node),
    // TODO: this are positions in the string with the replaced variables. Means it cannot be used to show exact
    //  placement of the error for the user. We need some translation table to positions before the variable
    //  replace.
    from: node.from,
    to: node.to,
    parentType: node.parent?.name,
  };
}

function isIntervalVariableError(node: SyntaxNode) {
  return node.prevSibling?.name === 'Expr' && node.prevSibling?.firstChild?.name === 'VectorSelector';
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
 * @param context
 */
function handleFunction(expr: string, node: SyntaxNode, context: Context) {
  const visQuery = context.query;
  const nameNode = node.getChild('FunctionIdentifier');
  const funcName = getString(expr, nameNode);

  const body = node.getChild('FunctionCallBody');
  const callArgs = body!.getChild('FunctionCallArgs');
  const params = [];
  let interval = '';

  // This is a bit of a shortcut to get the interval argument. Reasons are
  // - interval is not part of the function args per promQL grammar but we model it as argument for the function in
  //   the query model.
  // - it is easier to handle template variables this way as template variable is an error for the parser
  if (rangeFunctions.includes(funcName) || funcName.endsWith('_over_time')) {
    let match = getString(expr, node).match(/\[(.+)\]/);
    if (match?.[1]) {
      interval = match[1];
      params.push(match[1]);
    }
  }

  const op = { id: funcName, params };
  // We unshift operations to keep the more natural order that we want to have in the visual query editor.
  visQuery.operations.unshift(op);

  if (callArgs) {
    if (getString(expr, callArgs) === interval + ']') {
      // This is a special case where we have a function with a single argument and it is the interval.
      // This happens when you start adding operations in query builder and did not set a metric yet.
      return;
    }
    updateFunctionArgs(expr, callArgs, context, op);
  }
}

/**
 * Handle aggregation as they are distinct type from other functions.
 * @param expr
 * @param node
 * @param context
 */
function handleAggregation(expr: string, node: SyntaxNode, context: Context) {
  const visQuery = context.query;
  const nameNode = node.getChild('AggregateOp');
  let funcName = getString(expr, nameNode);

  const modifier = node.getChild('AggregateModifier');
  const labels = [];

  if (modifier) {
    const byModifier = modifier.getChild(`By`);
    if (byModifier && funcName) {
      funcName = `__${funcName}_by`;
    }

    const withoutModifier = modifier.getChild(`Without`);
    if (withoutModifier) {
      funcName = `__${funcName}_without`;
    }

    labels.push(...getAllByType(expr, modifier, 'GroupingLabel'));
  }

  const body = node.getChild('FunctionCallBody');
  const callArgs = body!.getChild('FunctionCallArgs');

  const op: QueryBuilderOperation = { id: funcName, params: [] };
  visQuery.operations.unshift(op);
  updateFunctionArgs(expr, callArgs, context, op);
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
 * @param context
 * @param op - We need the operation to add the params to as an additional context.
 */
function updateFunctionArgs(expr: string, node: SyntaxNode | null, context: Context, op: QueryBuilderOperation) {
  if (!node) {
    return;
  }
  switch (node.name) {
    // In case we have an expression we don't know what kind so we have to look at the child as it can be anything.
    case 'Expr':
    // FunctionCallArgs are nested bit weirdly as mentioned so we have to go one deeper in this case.
    case 'FunctionCallArgs': {
      let child = node.firstChild;
      while (child) {
        updateFunctionArgs(expr, child, context, op);
        child = child.nextSibling;
      }
      break;
    }

    case 'NumberLiteral': {
      op.params.push(parseFloat(getString(expr, node)));
      break;
    }

    case 'StringLiteral': {
      op.params.push(getString(expr, node).replace(/"/g, ''));
      break;
    }

    default: {
      // Means we get to something that does not seem like simple function arg and is probably nested query so jump
      // back to main context
      handleExpression(expr, node, context);
    }
  }
}

const operatorToOpName = binaryScalarDefs.reduce((acc, def) => {
  acc[def.sign] = def.id;
  return acc;
}, {} as Record<string, string>);

/**
 * Right now binary expressions can be represented in 2 way in visual query. As additional operation in case it is
 * just operation with scalar or it creates a binaryQuery when it's 2 queries.
 * @param expr
 * @param node
 * @param context
 */
function handleBinary(expr: string, node: SyntaxNode, context: Context) {
  const visQuery = context.query;
  const left = node.firstChild!;
  const op = getString(expr, left.nextSibling);
  // TODO: we are skipping BinModifiers
  const right = node.lastChild!;

  const opName = operatorToOpName[op];

  const leftNumber = left.getChild('NumberLiteral');
  const rightNumber = right.getChild('NumberLiteral');

  if (leftNumber || rightNumber) {
    // Scalar case, just add operation.
    if (leftNumber) {
      // TODO: this should be already handled in case parent is binary expression as it has to be added to parent
      //  if query starts with a number that isn't handled now.
    } else {
      handleExpression(expr, left, context);
    }

    if (rightNumber) {
      // TODO: this should be already handled in case parent is binary expression as it has to be added to parent
      //  if query starts with a number that isn't handled now.
      visQuery.operations.push({ id: opName, params: [parseInt(getString(expr, right), 10)] });
    } else {
      handleExpression(expr, right, context);
    }
    return;
  }

  const leftBinary = left.getChild('BinaryExpr');
  const rightBinary = right.getChild('BinaryExpr');

  if (leftBinary || rightBinary) {
    // One of the sides is binary which means we don't really know if there is a query or just chained scalars. So
    // we have to traverse a bit deeper to know
    handleExpression(expr, left, context);

    // Due to the way binary ops are parsed we can get a binary operation on the right that starts with a number which
    // is a factor for a current binary operation. So we have to add it as an operation now.
    const leftMostChild = getLeftMostChild(right);
    if (leftMostChild?.name === 'NumberLiteral') {
      visQuery.operations.push({ id: opName, params: [parseInt(getString(expr, leftMostChild), 10)] });
    }
    // If we added the first number literal as operation here we still can continue and handle the rest as the first
    // number will be just skipped.
    handleExpression(expr, right, context);
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
    handleExpression(expr, left, context);
    handleExpression(expr, right, {
      query: binQuery.query,
      errors: context.errors,
    });
  }
}

/**
 * Get the actual string of the expression. That is not stored in the tree so we have to get the indexes from the node
 * and then based on that get it from the expression.
 * @param expr
 * @param node
 */
function getString(expr: string, node: SyntaxNode | TreeCursor | null) {
  if (!node) {
    return '';
  }
  return returnVariables(expr.substring(node.from, node.to));
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

function getLeftMostChild(cur: SyntaxNode): SyntaxNode | null {
  let child = cur;
  while (true) {
    if (child.firstChild) {
      child = child.firstChild;
    } else {
      break;
    }
  }
  return child;
}

// Debugging function for convenience.
// @ts-ignore
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
