import { parser } from '@grafana/lezer-logql';
import { SyntaxNode, TreeCursor } from 'lezer-tree';
import { QueryBuilderLabelFilter, QueryBuilderOperation } from './shared/types';
import { LokiVisualQuery } from './types';

// This is used for error type
const ErrorName = '⚠';

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

    case 'RangeAggregationExpr': {
      visQuery.operations.push(handleRangeAggregation(expr, node, context));
      break;
    }

    case 'VectorAggregationExpr': {
      visQuery.operations.push(handleVectorAggregation(expr, node, context));
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
  const op = getString(expr, labelNode.nextSibling);
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
  const filterExpr = getString(expr, node.getChild('String')).replace(/"/g, '');

  return {
    id: mapFilter[filter],
    params: [filterExpr],
  };
}

function getLabelParser(expr: string, node: SyntaxNode): QueryBuilderOperation {
  const parserNode = node.firstChild;
  const parser = getString(expr, parserNode);

  const string = getString(expr, node.getChild('String')).replace(/"/g, '');
  const params = !!string ? [string] : [];
  return {
    id: parser,
    params,
  };
}

function getLabelFilter(expr: string, node: SyntaxNode): QueryBuilderOperation {
  const id = '__label_filter';

  const filterTypes = ['Matcher', 'NumberFilter'];

  if (filterTypes.includes(node.firstChild.name)) {
    const filter = node.firstChild;
    const label = filter.firstChild;
    const op = label.nextSibling;
    const value = op.nextSibling;
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

  if (node.firstChild.name === 'UnitFilter') {
    const filter = node.firstChild.firstChild;
    const label = filter.firstChild;
    const op = label.nextSibling;
    const value = op.nextSibling;

    return {
      id,
      params: [label, op, value].map((child) => getString(expr, child).replace(/"/g, '')),
    };
  }

  if (node.firstChild.name === 'IpLabelFilter') {
    //currently not supported in visual editor and it will throw error which will be logged in console
    const filter = node.firstChild;
    const label = filter.firstChild;
    const op = label.nextSibling;
    const ip = label.nextSibling;
    const value = op.nextSibling;
    return {
      id,
      params: [
        getString(expr, label),
        getString(expr, op),
        getString(expr, ip).replace(/"/g, ''),
        getString(expr, value).replace(/"/g, ''),
      ],
    };
  }
}

function getLineFormat(expr: string, node: SyntaxNode): QueryBuilderOperation {
  const id = 'line_format';
  const string = getString(expr, node.getChild('String')).replace(/"/g, '');

  return {
    id,
    params: [string],
  };
}

function getLabelFormat(expr: string, node: SyntaxNode): QueryBuilderOperation {
  const id = 'label_format';
  const identifier = node.getChild('Identifier');
  const op = identifier.nextSibling;
  const value = op.nextSibling;

  return {
    id,
    params: [getString(expr, identifier), getString(expr, op), getString(expr, value).replace(/"/g, '')],
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

  handleExpression(expr, logExpr, context);

  return op;
}

function handleVectorAggregation(expr: string, node: SyntaxNode, context: Context) {
  const nameNode = node.getChild('VectorOp');
  let funcName = getString(expr, nameNode);

  const metricExpr = node.getChild('MetricExpr');
  const op: QueryBuilderOperation = { id: funcName, params: [] };

  handleExpression(expr, metricExpr, context);
  return op;
}

function getString(expr: string, node: SyntaxNode | TreeCursor | null) {
  if (!node) {
    return '';
  }

  return returnVariables(expr.substring(node.from, node.to));
}

function makeError(expr: string, node: SyntaxNode) {
  return {
    text: getString(expr, node),
    from: node.from,
    to: node.to,
    parentType: node.parent?.name,
  };
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

function isIntervalVariableError(node: SyntaxNode) {
  return node.parent.name === 'Range';
}

// Templating
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
