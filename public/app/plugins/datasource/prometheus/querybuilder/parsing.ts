import { parser } from 'lezer-promql';
import { SyntaxNode, TreeCursor } from 'lezer-tree';
import { QueryBuilderLabelFilter, QueryBuilderOperation } from './shared/types';
import { PromVisualQuery } from './types';

export function buildVisualQueryFromString(expr: string) {
  const tree = parser.parse(expr);
  const node = tree.topNode;

  const visQuery: PromVisualQuery = {
    metric: '',
    labels: [],
    operations: [],
  };

  handleExpression(expr, node, visQuery);
  return visQuery;
}

export function handleExpression(expr: string, node: SyntaxNode, visQuery: PromVisualQuery) {
  switch (node.name) {
    case 'MetricIdentifier': {
      visQuery.metric = getString(expr, node);
      break;
    }

    case 'LabelMatcher': {
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

function handleFunction(expr: string, node: SyntaxNode, visQuery: PromVisualQuery) {
  const nameNode = node.getChild('FunctionIdentifier');
  const funcName = getString(expr, nameNode);

  const body = node.getChild('FunctionCallBody');
  const callArgs = body!.getChild('FunctionCallArgs');
  const params = [];

  if (rangeFunctions.includes(funcName) || funcName.endsWith('_over_time')) {
    let match = getString(expr, node).match(/\[([\$_\w]+)\]/);
    if (match?.[1]) {
      params.push(match[1]);
    }
  }

  const op = { id: funcName, params };
  visQuery.operations.unshift(op);
  updateFunctionArgs(expr, callArgs!, visQuery, op);
}

function handleAggregation(expr: string, node: SyntaxNode, visQuery: PromVisualQuery) {
  const nameNode = node.getChild('AggregateOp');
  let funcName = getString(expr, nameNode);

  const modifier = node.getChild('AggregateModifier');
  const labels = [];
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
  op.params.push(...labels);
}

function updateFunctionArgs(expr: string, node: SyntaxNode, visQuery: PromVisualQuery, op: QueryBuilderOperation) {
  switch (node.name) {
    // In case we have an expression we don't know what kind so we have to look at the child
    case 'Expr':
    // FunctionCallArgs are nested bit weirdly basically its [firstArg, ...rest] where rest is again FunctionCallArgs
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
      // Means we get to something that does not seem like function arg so jump back to main context
      handleExpression(expr, node, visQuery);
    }
  }
}

const operatorToOpName: Record<string, string> = {
  '/': '__divide_by',
  '*': '__multiply_by',
};

function handleBinary(expr: string, node: SyntaxNode, visQuery: PromVisualQuery) {
  const left = node.firstChild!;
  const op = getString(expr, left.nextSibling);
  const right = node.lastChild!;

  const opName = operatorToOpName[op];

  const leftNumber = left.getChild('NumberLiteral');
  const rightNumber = right.getChild('NumberLiteral');

  if (leftNumber || rightNumber) {
    const [num, query] = leftNumber ? [leftNumber, right] : [rightNumber, left];
    visQuery.operations.push({ id: opName, params: [parseInt(getString(expr, num), 10)] });
    handleExpression(expr, query, visQuery);
  } else {
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
    handleExpression(expr, left, visQuery);
    handleExpression(expr, right, binQuery.query);
  }
}

function getString(expr: string, cur: TreeCursor | SyntaxNode | null) {
  if (!cur) {
    return '';
  }
  return expr.substring(cur.from, cur.to);
}

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

const rangeFunctions = ['changes', 'rate', 'irate', 'increase', 'delta'];
