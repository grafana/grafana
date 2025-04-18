import { SyntaxNode } from '@lezer/common';

import {
  And,
  BinOpExpr,
  Bool,
  By,
  ConvOp,
  Decolorize,
  DropLabel,
  DropLabels,
  DropLabelsExpr,
  Filter,
  FilterOp,
  Grouping,
  GroupingLabelList,
  GroupingLabels,
  Identifier,
  Ip,
  IpLabelFilter,
  Json,
  JsonExpressionParser,
  KeepLabel,
  KeepLabels,
  KeepLabelsExpr,
  LabelExtractionExpression,
  LabelFilter,
  LabelFormatMatcher,
  LabelParser,
  LineFilter,
  LineFormatExpr,
  LogfmtExpressionParser,
  LogfmtParser,
  LogRangeExpr,
  Matcher,
  MetricExpr,
  Number as NumberLezer,
  On,
  Or,
  parser,
  ParserFlag,
  Range,
  RangeAggregationExpr,
  RangeOp,
  String,
  UnitFilter,
  Unwrap,
  UnwrapExpr,
  VectorAggregationExpr,
  VectorOp,
  Without,
  BinOpModifier,
  OnOrIgnoringModifier,
  OrFilter,
} from '@grafana/lezer-logql';
import { QueryBuilderLabelFilter, QueryBuilderOperation, QueryBuilderOperationParamValue } from '@grafana/plugin-ui';

import { binaryScalarDefs } from './binaryScalarOperations';
import { checkParamsAreValid, getDefinitionById } from './operations';
import {
  ErrorId,
  getAllByType,
  getLeftMostChild,
  getString,
  makeBinOp,
  makeError,
  replaceVariables,
} from './parsingUtils';
import { LokiOperationId, LokiVisualQuery, LokiVisualQueryBinary } from './types';

interface Context {
  query: LokiVisualQuery;
  errors: ParsingError[];
}

interface ParsingError {
  text: string;
  from?: number;
  to?: number;
  parentType?: string;
}

interface GetOperationResult {
  operation?: QueryBuilderOperation;
  error?: string;
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

  const context: Context = {
    query: visQuery,
    errors: [],
  };

  try {
    handleExpression(replacedExpr, node, context);
  } catch (err) {
    // Not ideal to log it here, but otherwise we would lose the stack trace.
    console.error(err);
    if (err instanceof Error) {
      context.errors.push({
        text: err.message,
      });
    }
  }

  // If we have empty query, we want to reset errors
  if (isEmptyQuery(context.query)) {
    context.errors = [];
  }
  return context;
}

export function handleExpression(expr: string, node: SyntaxNode, context: Context) {
  const visQuery = context.query;
  switch (node.type.id) {
    case Matcher: {
      visQuery.labels.push(getLabel(expr, node));
      const err = node.getChild(ErrorId);
      if (err) {
        context.errors.push(makeError(expr, err));
      }
      break;
    }

    case LineFilter: {
      const { operation, error } = getLineFilter(expr, node);
      if (operation) {
        visQuery.operations.push(operation);
      }
      // Show error for query patterns not supported in visual query builder
      if (error) {
        context.errors.push(createNotSupportedError(expr, node, error));
      }
      break;
    }

    case LabelParser: {
      visQuery.operations.push(getLabelParser(expr, node));
      break;
    }

    case LabelFilter: {
      const { operation, error } = getLabelFilter(expr, node);
      if (operation) {
        visQuery.operations.push(operation);
      }
      // Show error for query patterns not supported in visual query builder
      if (error) {
        context.errors.push(createNotSupportedError(expr, node, error));
      }
      break;
    }
    case JsonExpressionParser: {
      visQuery.operations.push(getJsonExpressionParser(expr, node));
      break;
    }

    case LogfmtParser:
    case LogfmtExpressionParser: {
      const { operation, error } = getLogfmtParser(expr, node);
      if (operation) {
        visQuery.operations.push(operation);
      }
      if (error) {
        context.errors.push(createNotSupportedError(expr, node, error));
      }
      break;
    }

    case LineFormatExpr: {
      visQuery.operations.push(getLineFormat(expr, node));
      break;
    }

    case LabelFormatMatcher: {
      visQuery.operations.push(getLabelFormat(expr, node));
      break;
    }

    case UnwrapExpr: {
      const { operation, error } = handleUnwrapExpr(expr, node, context);
      if (operation) {
        visQuery.operations.push(operation);
      }
      // Show error for query patterns not supported in visual query builder
      if (error) {
        context.errors.push(createNotSupportedError(expr, node, error));
      }

      break;
    }

    case Decolorize: {
      visQuery.operations.push(getDecolorize());
      break;
    }

    case RangeAggregationExpr: {
      visQuery.operations.push(handleRangeAggregation(expr, node, context));
      break;
    }

    case VectorAggregationExpr: {
      visQuery.operations.push(handleVectorAggregation(expr, node, context));
      break;
    }

    case BinOpExpr: {
      handleBinary(expr, node, context);
      break;
    }

    case ErrorId: {
      if (isIntervalVariableError(node)) {
        break;
      }
      context.errors.push(makeError(expr, node));
      break;
    }

    case DropLabelsExpr: {
      visQuery.operations.push(handleDropFilter(expr, node, context));
      break;
    }

    case KeepLabelsExpr: {
      visQuery.operations.push(handleKeepFilter(expr, node, context));
      break;
    }

    default: {
      // Any other nodes we just ignore and go to its children. This should be fine as there are lots of wrapper
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
  const labelNode = node.getChild(Identifier);
  const label = getString(expr, labelNode);
  const op = getString(expr, labelNode?.nextSibling);
  let value = getString(expr, node.getChild(String));
  // `value` is wrapped in double quotes, so we need to remove them. As a value can contain double quotes, we can't use RegEx here.
  value = value.substring(1, value.length - 1);

  return {
    label,
    op,
    value,
  };
}

function getLineFilter(expr: string, node: SyntaxNode): GetOperationResult {
  const filter = getString(expr, node.getChild(Filter));
  const filterExpr = handleQuotes(getString(expr, node.getChild(String)));
  const ipLineFilter = node.getChild(FilterOp)?.getChild(Ip);
  if (ipLineFilter) {
    return {
      operation: {
        id: LokiOperationId.LineFilterIpMatches,
        params: [filter, filterExpr],
      },
    };
  }

  const params = [filterExpr];
  let orFilter = node.getChild(OrFilter);
  while (orFilter) {
    params.push(handleQuotes(getString(expr, orFilter.getChild(String))));
    orFilter = orFilter.getChild(OrFilter);
  }

  const mapFilter: Record<string, LokiOperationId> = {
    '|=': LokiOperationId.LineContains,
    '!=': LokiOperationId.LineContainsNot,
    '|~': LokiOperationId.LineMatchesRegex,
    '!~': LokiOperationId.LineMatchesRegexNot,
  };

  return {
    operation: {
      id: mapFilter[filter],
      params,
    },
  };
}

function getLabelParser(expr: string, node: SyntaxNode): QueryBuilderOperation {
  const parserNode = node.firstChild;
  const parser = getString(expr, parserNode);

  const string = handleQuotes(getString(expr, node.getChild(String)));
  let params: QueryBuilderOperationParamValue[] = !!string ? [string] : [];
  const opDef = getDefinitionById(parser);
  if (opDef && !checkParamsAreValid(opDef, params)) {
    params = opDef?.defaultParams || [];
  }

  return {
    id: parser,
    params,
  };
}

function getJsonExpressionParser(expr: string, node: SyntaxNode): QueryBuilderOperation {
  const parserNode = node.getChild(Json);
  const parser = getString(expr, parserNode);

  const params = [...getAllByType(expr, node, LabelExtractionExpression)];
  return {
    id: parser,
    params,
  };
}

function getLogfmtParser(expr: string, node: SyntaxNode): GetOperationResult {
  const flags: string[] = [];
  const labels: string[] = [];
  let error: string | undefined = undefined;

  const offset = node.from;
  node.toTree().iterate({
    enter: (subNode) => {
      if (subNode.type.id === ParserFlag) {
        flags.push(expr.substring(subNode.from + offset, subNode.to + offset));
      } else if (subNode.type.id === LabelExtractionExpression) {
        labels.push(expr.substring(subNode.from + offset, subNode.to + offset));
      } else if (subNode.type.id === ErrorId) {
        error = `Unexpected string "${expr.substring(subNode.from + offset, subNode.to + offset)}"`;
      }
    },
  });

  const operation = {
    id: LokiOperationId.Logfmt,
    params: [flags.includes('--strict'), flags.includes('--keep-empty'), ...labels],
  };

  return {
    operation,
    error,
  };
}

function getLabelFilter(expr: string, node: SyntaxNode): GetOperationResult {
  // Check for nodes not supported in visual builder and return error
  if (node.getChild(Or) || node.getChild(And) || node.getChild('Comma')) {
    return {
      error: 'Label filter with comma, "and", "or" not supported in query builder',
    };
  }
  if (node.firstChild!.type.id === IpLabelFilter) {
    const ipLabelFilter = node.firstChild;
    const label = ipLabelFilter?.getChild(Identifier);
    const op = label?.nextSibling;
    const value = ipLabelFilter?.getChild(String);
    const valueString = handleQuotes(getString(expr, value));

    return {
      operation: {
        id: LokiOperationId.LabelFilterIpMatches,
        params: [getString(expr, label), getString(expr, op), valueString],
      },
    };
  }

  const id = LokiOperationId.LabelFilter;
  if (node.firstChild!.type.id === UnitFilter) {
    const filter = node.firstChild!.firstChild;
    const label = filter!.firstChild;
    const op = label!.nextSibling;
    const value = op!.nextSibling;
    const valueString = handleQuotes(getString(expr, value));

    return {
      operation: {
        id,
        params: [getString(expr, label), getString(expr, op), valueString],
      },
    };
  }
  // In this case it is Matcher or NumberFilter
  const filter = node.firstChild;
  const label = filter!.firstChild;
  const op = label!.nextSibling;
  const value = op!.nextSibling;
  const params = [getString(expr, label), getString(expr, op), handleQuotes(getString(expr, value))];

  // Special case of pipe filtering - no errors
  if (params.join('') === `__error__=`) {
    return {
      operation: {
        id: LokiOperationId.LabelFilterNoErrors,
        params: [],
      },
    };
  }

  return {
    operation: {
      id,
      params,
    },
  };
}

function getLineFormat(expr: string, node: SyntaxNode): QueryBuilderOperation {
  const id = LokiOperationId.LineFormat;
  const string = handleQuotes(getString(expr, node.getChild(String)));

  return {
    id,
    params: [string],
  };
}

function getLabelFormat(expr: string, node: SyntaxNode): QueryBuilderOperation {
  const id = LokiOperationId.LabelFormat;
  const renameTo = node.getChild(Identifier);
  const op = renameTo!.nextSibling;
  const originalLabel = op!.nextSibling;

  return {
    id,
    params: [getString(expr, originalLabel), handleQuotes(getString(expr, renameTo))],
  };
}

function getDecolorize(): QueryBuilderOperation {
  const id = LokiOperationId.Decolorize;

  return {
    id,
    params: [],
  };
}

function handleUnwrapExpr(expr: string, node: SyntaxNode, context: Context): GetOperationResult {
  const unwrapExprChild = node.getChild(UnwrapExpr);
  const labelFilterChild = node.getChild(LabelFilter);
  const unwrapChild = node.getChild(Unwrap);

  if (unwrapExprChild) {
    handleExpression(expr, unwrapExprChild, context);
  }

  if (labelFilterChild) {
    handleExpression(expr, labelFilterChild, context);
  }

  if (unwrapChild) {
    if (unwrapChild.nextSibling?.type.id === ConvOp) {
      const convOp = unwrapChild.nextSibling;
      const identifier = convOp.nextSibling;
      return {
        operation: {
          id: LokiOperationId.Unwrap,
          params: [getString(expr, identifier), getString(expr, convOp)],
        },
      };
    }

    return {
      operation: {
        id: LokiOperationId.Unwrap,
        params: [getString(expr, unwrapChild?.nextSibling), ''],
      },
    };
  }

  return {};
}

function handleRangeAggregation(expr: string, node: SyntaxNode, context: Context) {
  const nameNode = node.getChild(RangeOp);
  const funcName = getString(expr, nameNode);
  const number = node.getChild(NumberLezer);
  const logExpr = node.getChild(LogRangeExpr);
  const params = number !== null && number !== undefined ? [getString(expr, number)] : [];
  const range = logExpr?.getChild(Range);
  const rangeValue = range ? getString(expr, range) : null;
  const grouping = node.getChild(Grouping);

  if (rangeValue) {
    params.unshift(rangeValue.substring(1, rangeValue.length - 1));
  }

  if (grouping) {
    params.push(...getAllByType(expr, grouping, Identifier));
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
  const nameNode = node.getChild(VectorOp);
  let funcName = getString(expr, nameNode);

  const grouping = node.getChild(Grouping);
  const params = [];

  const numberNode = node.getChild(NumberLezer);
  const errorNode = node.getChild(ErrorId)?.getChild(Identifier);

  if (numberNode) {
    params.push(Number(getString(expr, numberNode)));
  } else if (errorNode) {
    // Variables get parsed as errors, so the value us an identifier within an error node.
    params.push(getString(expr, errorNode));
  }

  if (grouping) {
    const byModifier = grouping.getChild(By);
    if (byModifier && funcName) {
      funcName = `__${funcName}_by`;
    }

    const withoutModifier = grouping.getChild(Without);
    if (withoutModifier) {
      funcName = `__${funcName}_without`;
    }

    params.push(...getAllByType(expr, grouping, Identifier));
  }

  const metricExpr = node.getChild(MetricExpr);
  const op: QueryBuilderOperation = { id: funcName, params };

  if (metricExpr) {
    // A vector aggregation expression with a child of metric expression with a child of binary expression is ambiguous after being parsed into a visual query
    if (metricExpr.firstChild?.type.id === BinOpExpr) {
      context.errors.push({
        text: 'Query parsing is ambiguous.',
        from: metricExpr.firstChild.from,
        to: metricExpr.firstChild?.to,
      });
    }

    handleExpression(expr, metricExpr, context);
  }

  return op;
}

const operatorToOpName = binaryScalarDefs.reduce<Record<string, { id: string; comparison?: boolean }>>((acc, def) => {
  acc[def.sign] = {
    id: def.id,
    comparison: def.comparison,
  };
  return acc;
}, {});

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
  const binModifier = getBinaryModifier(expr, node.getChild(BinOpModifier));

  const right = node.lastChild!;

  const opDef = operatorToOpName[op];

  const leftNumber = getLastChildWithSelector(left, 'MetricExpr.LiteralExpr.Number');
  const rightNumber = getLastChildWithSelector(right, 'MetricExpr.LiteralExpr.Number');

  const rightBinary = right.getChild(BinOpExpr);

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
    if (leftMostChild?.type.id === NumberLezer) {
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
  | { isBool: boolean; isMatcher: true; matches: string; matchType: 'ignoring' | 'on' }
  | undefined {
  if (!node) {
    return undefined;
  }
  const matcher = node.getChild(OnOrIgnoringModifier);
  const boolMatcher = node.getChild(Bool);

  if (!matcher && boolMatcher) {
    return { isBool: true, isMatcher: false };
  } else {
    if (!matcher) {
      // Not sure what this could be, maybe should be an error.
      return undefined;
    }
    const labels = getString(expr, matcher.getChild(GroupingLabels)?.getChild(GroupingLabelList));
    return {
      isMatcher: true,
      isBool: !!boolMatcher,
      matches: labels,
      matchType: matcher.getChild(On) ? 'on' : 'ignoring',
    };
  }
}

function isIntervalVariableError(node: SyntaxNode) {
  return node?.parent?.type.id === Range;
}

export function handleQuotes(string: string) {
  if (string[0] === `"` && string[string.length - 1] === `"`) {
    return string
      .substring(1, string.length - 1)
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
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

/**
 * Helper function to enrich error text with information that visual query builder doesn't support that logQL
 * @param expr
 * @param node
 * @param error
 */
function createNotSupportedError(expr: string, node: SyntaxNode, error: string) {
  const err = makeError(expr, node);
  err.text = `${error}: ${err.text}`;
  return err;
}

function isEmptyQuery(query: LokiVisualQuery) {
  if (query.labels.length === 0 && query.operations.length === 0) {
    return true;
  }
  return false;
}

function handleDropFilter(expr: string, node: SyntaxNode, context: Context): QueryBuilderOperation {
  const labels: string[] = [];
  let exploringNode = node.getChild(DropLabels);
  while (exploringNode) {
    const label = getString(expr, exploringNode.getChild(DropLabel));
    if (label) {
      labels.push(label);
    }
    exploringNode = exploringNode?.getChild(DropLabels);
  }
  labels.reverse();
  return {
    id: LokiOperationId.Drop,
    params: labels,
  };
}

function handleKeepFilter(expr: string, node: SyntaxNode, context: Context): QueryBuilderOperation {
  const labels: string[] = [];
  let exploringNode = node.getChild(KeepLabels);
  while (exploringNode) {
    const label = getString(expr, exploringNode.getChild(KeepLabel));
    if (label) {
      labels.push(label);
    }
    exploringNode = exploringNode?.getChild(KeepLabels);
  }
  labels.reverse();
  return {
    id: LokiOperationId.Keep,
    params: labels,
  };
}
