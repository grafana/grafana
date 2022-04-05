import { parser } from '@grafana/lezer-logql';
import { SyntaxNode } from '@lezer/common';
import {
  ErrorName,
  getAllByType,
  getLeftMostChild,
  getString,
  makeBinOp,
  makeError,
  replaceVariables,
} from '../../prometheus/querybuilder/shared/parsingUtils';
import { QueryBuilderLabelFilter, QueryBuilderOperation } from '../../prometheus/querybuilder/shared/types';
import { binaryScalarDefs } from './binaryScalarOperations';
import { LokiVisualQuery, LokiVisualQueryBinary } from './types';

interface Context {
  query: LokiVisualQuery;
  errors: ParsingError[];
}

interface ParsingError {
  text: string;
  from: number;
  to: number;
  parentType?: string;
}

export function buildVisualQueryFromString(expr: string): Context {
  const replacedExpr = replaceVariables(expr);
  const tree = parser.parse(replacedExpr);
  const node = tree.topNode;

  // This will be modified in the handleExpression
  const visQuery: LokiVisualQuery = {
    labels: [],
    operations: [],
  };

  const context = {
    query: visQuery,
    errors: [],
  };

  handleExpression(replacedExpr, node, context);
  return context;
}

export function handleExpression(expr: string, node: SyntaxNode, context: Context) {
  const visQuery = context.query;
  switch (node.name) {
    case 'Matcher': {
      visQuery.labels.push(getLabel(expr, node));
      const err = node.getChild(ErrorName);
      if (err) {
        context.errors.push(makeError(expr, err));
      }
      break;
    }

    case 'LineFilter': {
      visQuery.operations.push(getLineFilter(expr, node));
      break;
    }

    case 'LabelParser': {
      visQuery.operations.push(getLabelParser(expr, node));
      break;
    }

    case 'LabelFilter': {
      visQuery.operations.push(getLabelFilter(expr, node));
      break;
    }

    // Need to figure out JsonExpressionParser

    case 'LineFormatExpr': {
      visQuery.operations.push(getLineFormat(expr, node));
      break;
    }

    case 'LabelFormatMatcher': {
      visQuery.operations.push(getLabelFormat(expr, node));
      break;
    }

    case 'UnwrapExpr': {
      visQuery.operations.push(getUnwrap(expr, node));
      break;
    }

    case 'RangeAggregationExpr': {
      visQuery.operations.push(handleRangeAggregation(expr, node, context));
      break;
    }

    case 'VectorAggregationExpr': {
      visQuery.operations.push(handleVectorAggregation(expr, node, context));
      break;
    }

    case 'BinOpExpr': {
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

function getLabel(expr: string, node: SyntaxNode): QueryBuilderLabelFilter {
  const labelNode = node.getChild('Identifier');
  const label = getString(expr, labelNode);
  const op = getString(expr, labelNode!.nextSibling);
  const value = getString(expr, node.getChild('String')).replace(/"/g, '');

  return {
    label,
    op,
    value,
  };
}

function getLineFilter(expr: string, node: SyntaxNode): QueryBuilderOperation {
  const mapFilter: any = {
    '|=': '__line_contains',
    '!=': '__line_contains_not',
    '|~': '__line_matches_regex',
    '!~': '"__line_matches_regex"_not',
  };
  const filter = getString(expr, node.getChild('Filter'));
  const filterExpr = handleQuotes(getString(expr, node.getChild('String')));

  return {
    id: mapFilter[filter],
    params: [filterExpr],
  };
}

function getLabelParser(expr: string, node: SyntaxNode): QueryBuilderOperation {
  const parserNode = node.firstChild;
  const parser = getString(expr, parserNode);

  const string = handleQuotes(getString(expr, node.getChild('String')));
  const params = !!string ? [string] : [];
  return {
    id: parser,
    params,
  };
}

function getLabelFilter(expr: string, node: SyntaxNode): QueryBuilderOperation {
  const id = '__label_filter';

  if (node.firstChild!.name === 'UnitFilter') {
    const filter = node.firstChild!.firstChild;
    const label = filter!.firstChild;
    const op = label!.nextSibling;
    const value = op!.nextSibling;
    const valueString = handleQuotes(getString(expr, value));

    return {
      id,
      params: [getString(expr, label), getString(expr, op), valueString],
    };
  }

  if (node.firstChild!.name === 'IpLabelFilter') {
    // Not implemented in visual query builder yet
    const filter = node.firstChild!;
    const label = filter.firstChild!;
    const op = label.nextSibling!;
    const ip = label.nextSibling;
    const value = op.nextSibling!;
    return {
      id,
      params: [
        getString(expr, label),
        getString(expr, op),
        handleQuotes(getString(expr, ip)),
        handleQuotes(getString(expr, value)),
      ],
    };
  } else {
    // In this case it is Matcher or NumberFilter
    const filter = node.firstChild;
    const label = filter!.firstChild;
    const op = label!.nextSibling;
    const value = op!.nextSibling;
    const params = [getString(expr, label), getString(expr, op), getString(expr, value).replace(/"/g, '')];

    //Special case of pipe filtering - no errors
    if (params.join('') === `__error__=`) {
      return {
        id: '__label_filter_no_errors',
        params: [],
      };
    }

    return {
      id,
      params,
    };
  }
}

function getLineFormat(expr: string, node: SyntaxNode): QueryBuilderOperation {
  const id = 'line_format';
  const string = handleQuotes(getString(expr, node.getChild('String')));

  return {
    id,
    params: [string],
  };
}

function getLabelFormat(expr: string, node: SyntaxNode): QueryBuilderOperation {
  const id = 'label_format';
  const identifier = node.getChild('Identifier');
  const op = identifier!.nextSibling;
  const value = op!.nextSibling;

  let valueString = handleQuotes(getString(expr, value));

  return {
    id,
    params: [getString(expr, identifier), getString(expr, op), valueString],
  };
}

function getUnwrap(expr: string, node: SyntaxNode): QueryBuilderOperation {
  const id = 'unwrap';
  const string = getString(expr, node.getChild('Identifier'));

  return {
    id,
    params: [string],
  };
}

function handleRangeAggregation(expr: string, node: SyntaxNode, context: Context) {
  const nameNode = node.getChild('RangeOp');
  const funcName = getString(expr, nameNode);
  const number = node.getChild('Number');
  const logExpr = node.getChild('LogRangeExpr');
  const params = number !== null && number !== undefined ? [getString(expr, number)] : [];

  let match = getString(expr, node).match(/\[(.+)\]/);
  if (match?.[1]) {
    params.push(match[1]);
  }

  const op = {
    id: funcName,
    params,
  };

  if (logExpr) {
    handleExpression(expr, logExpr, context);
  }

  return op;
}

function handleVectorAggregation(expr: string, node: SyntaxNode, context: Context) {
  const nameNode = node.getChild('VectorOp');
  let funcName = getString(expr, nameNode);

  const grouping = node.getChild('Grouping');
  const labels: string[] = [];

  if (grouping) {
    const byModifier = grouping.getChild(`By`);
    if (byModifier && funcName) {
      funcName = `__${funcName}_by`;
    }

    const withoutModifier = grouping.getChild(`Without`);
    if (withoutModifier) {
      funcName = `__${funcName}_without`;
    }

    labels.push(...getAllByType(expr, grouping, 'Identifier'));
  }

  const metricExpr = node.getChild('MetricExpr');
  const op: QueryBuilderOperation = { id: funcName, params: labels };

  if (metricExpr) {
    handleExpression(expr, metricExpr, context);
  }

  return op;
}

const operatorToOpName = binaryScalarDefs.reduce((acc, def) => {
  acc[def.sign] = {
    id: def.id,
    comparison: def.comparison,
  };
  return acc;
}, {} as Record<string, { id: string; comparison?: boolean }>);

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
  const binModifier = getBinaryModifier(expr, node.getChild('BinModifiers'));

  const right = node.lastChild!;

  const opDef = operatorToOpName[op];

  const leftNumber = getLastChildWithSelector(left, 'MetricExpr.LiteralExpr.Number');
  const rightNumber = getLastChildWithSelector(right, 'MetricExpr.LiteralExpr.Number');

  const rightBinary = right.getChild('BinOpExpr');

  if (leftNumber) {
    // TODO: this should be already handled in case parent is binary expression as it has to be added to parent
    //  if query starts with a number that isn't handled now.
  } else {
    // If this is binary we don't really know if there is a query or just chained scalars. So
    // we have to traverse a bit deeper to know
    handleExpression(expr, left, context);
  }

  if (rightNumber) {
    visQuery.operations.push(makeBinOp(opDef, expr, right, !!binModifier?.isBool));
  } else if (rightBinary) {
    // Due to the way binary ops are parsed we can get a binary operation on the right that starts with a number which
    // is a factor for a current binary operation. So we have to add it as an operation now.
    const leftMostChild = getLeftMostChild(right);
    if (leftMostChild?.name === 'Number') {
      visQuery.operations.push(makeBinOp(opDef, expr, leftMostChild, !!binModifier?.isBool));
    }

    // If we added the first number literal as operation here we still can continue and handle the rest as the first
    // number will be just skipped.
    handleExpression(expr, right, context);
  } else {
    visQuery.binaryQueries = visQuery.binaryQueries || [];
    const binQuery: LokiVisualQueryBinary = {
      operator: op,
      query: {
        labels: [],
        operations: [],
      },
    };
    if (binModifier?.isMatcher) {
      binQuery.vectorMatchesType = binModifier.matchType;
      binQuery.vectorMatches = binModifier.matches;
    }
    visQuery.binaryQueries.push(binQuery);
    handleExpression(expr, right, {
      query: binQuery.query,
      errors: context.errors,
    });
  }
}

function getBinaryModifier(
  expr: string,
  node: SyntaxNode | null
):
  | { isBool: true; isMatcher: false }
  | { isBool: false; isMatcher: true; matches: string; matchType: 'ignoring' | 'on' }
  | undefined {
  if (!node) {
    return undefined;
  }
  if (node.getChild('Bool')) {
    return { isBool: true, isMatcher: false };
  } else {
    const matcher = node.getChild('OnOrIgnoring');
    if (!matcher) {
      // Not sure what this could be, maybe should be an error.
      return undefined;
    }
    const labels = getString(expr, matcher.getChild('GroupingLabels')?.getChild('GroupingLabelList'));
    return {
      isMatcher: true,
      isBool: false,
      matches: labels,
      matchType: matcher.getChild('On') ? 'on' : 'ignoring',
    };
  }
}

function isIntervalVariableError(node: SyntaxNode) {
  return node?.parent?.name === 'Range';
}

function handleQuotes(string: string) {
  if (string[0] === `"` && string[string.length - 1] === `"`) {
    return string.replace(/"/g, '').replace(/\\\\/g, '\\');
  }
  return string.replace(/`/g, '');
}

/**
 * Simple helper to traverse the syntax tree. Instead of node.getChild('foo')?.getChild('bar')?.getChild('baz') you
 * can write getChildWithSelector(node, 'foo.bar.baz')
 * @param node
 * @param selector
 */
function getLastChildWithSelector(node: SyntaxNode, selector: string) {
  let child: SyntaxNode | null = node;
  const children = selector.split('.');
  for (const s of children) {
    child = child.getChild(s);
    if (!child) {
      return null;
    }
  }
  return child;
}
