import { SyntaxNode } from '@lezer/common';
import { trimEnd } from 'lodash';

import { TypedVariableModel } from '@grafana/data';
import {
  Identifier,
  String,
  LogExpr,
  Matcher,
  parser,
  PipelineExpr,
  Selector,
  LabelParser,
  LabelFilter,
  JsonExpressionParser,
  LineFormatExpr,
  LabelFormatExpr,
  LineComment,
  LineFilter,
  Filter,
  Regexp,
  Pattern,
  JsonExpression,
  IpLabelFilter,
  UnitFilter,
  NumberFilter,
  DurationFilter,
  BytesFilter,
  Duration,
  Bytes,
  Number,
  LabelFormatMatcher,
  FilterOp,
  MetricExpr,
  RangeAggregationExpr,
  RangeOp,
  LogRangeExpr,
  Range,
  Grouping,
  OffsetExpr,
  VectorAggregationExpr,
  Expr,
  UnwrapExpr,
  By,
  Without,
  ConvOp,
  BinOpExpr,
  LiteralExpr,
  LabelReplaceExpr,
  VectorExpr,
  VectorOp,
} from '@grafana/lezer-logql';
import { getTemplateSrv } from '@grafana/runtime';

import { isValidQuery } from './queryUtils';

// todo: complete all metric query types
// todo: complete and refactor variable transformation

export const formatLokiQuery = (query: string): string => {
  if (isValidQuery(query) === false) {
    return query;
  }

  const { transformedQuery, transformations } = transformVariablesToValue(query);

  const tree = parser.parse(transformedQuery);
  let formatted = '';

  tree.iterate({
    enter: (ref): void => {
      const node = ref.node;

      if (node.parent?.type.id !== Expr) {
        return;
      }

      switch (node.type.id) {
        case MetricExpr:
          formatted = formatMetricExpr(node, transformedQuery);
          break;

        case LogExpr:
          formatted = formatLogExpr(node, transformedQuery);
          break;
      }
    },
  });

  return transformValuesToVariables(formatted, transformations);
};

/* 
the functions below are used to format metric queries
*/

const formatMetricExpr = (node: SyntaxNode, query: string): string => {
  const tree = parser.parse(query.substring(node.from, node.to));
  let formatted = '';

  tree.iterate({
    enter: (ref): void => {
      const node = ref.node;

      if (node.parent?.parent?.type.id !== Expr) {
        return;
      }

      switch (node.type.id) {
        case RangeAggregationExpr:
          formatted = formatRangeAggregationExpr(node, query);
          break;

        case VectorAggregationExpr:
          formatted = formatVectorAggregationExpr(node, query);
          break;

        case BinOpExpr:
          formatted = formatBinOpExpr(node, query);
          break;

        case LiteralExpr:
          break;

        case LabelReplaceExpr:
          break;

        case VectorExpr:
          break;
      }
    },
  });

  return formatted;
};

function formatRangeAggregationExpr(node: SyntaxNode, query: string): string {
  let response = '';

  iterateNode(node, [RangeOp, Number, LogRangeExpr, Grouping]).forEach((node) => {
    if (node.parent?.type.id !== RangeAggregationExpr) {
      return;
    }

    switch (node.type.id) {
      case RangeOp:
        response += `${query.substring(node.from, node.to)}(\n`;
        break;

      case Number:
        response += `${indent(0.5) + query.substring(node.from, node.to)},\n`;
        break;

      case LogRangeExpr:
        response += formatLogRangeExpr(node, query);
        break;

      case Grouping:
        response += formatGrouping(node, query);
        break;
    }
  });

  return response;
}

function formatLogRangeExpr(node: SyntaxNode, query: string): string {
  const nodes: SyntaxNode[] = [];
  let selector = '';
  let pipeline = '';
  let range = '';
  let offset = '';
  let unwrap = '';

  iterateNode(node, [Selector, Range, OffsetExpr, UnwrapExpr, PipelineExpr]).forEach((node, _, arr) => {
    if (node.parent?.type.id !== LogRangeExpr) {
      return;
    }

    nodes.push(node);

    switch (node.type.id) {
      case Selector:
        let logExpr = query.substring(node.from, node.to);
        selector += formatSelector({ from: 0, to: logExpr.length } as SyntaxNode, logExpr);
        break;

      case PipelineExpr:
        pipeline += formatPipelineExpr(node, query);
        break;

      case Range:
        range += query.substring(node.from, node.to);
        break;

      case OffsetExpr:
        const durationNode = node.getChild(Duration);
        offset += ` offset ${durationNode ? query.substring(durationNode.from, durationNode.to) : ''}`;
        break;

      case UnwrapExpr:
        iterateNode(node, [Identifier, ConvOp]).forEach((node, _, arr) => {
          switch (node.type.id) {
            case Identifier:
              const hasConvOp = arr.find((node) => node.type.id === ConvOp);

              if (hasConvOp) {
                return;
              }

              unwrap += `| unwrap ${query.substring(node.from, node.to)} `;
              return;

            case ConvOp:
              const identifierNode = arr.find((node) => node.type.id === Identifier);
              const identifier = identifierNode ? query.substring(identifierNode.from, identifierNode.to) : '';
              unwrap += `| unwrap ${query.substring(node.from, node.to)}(${identifier})`;
              return;
          }
        });
        break;
    }
  });

  let response = '';
  nodes.forEach((node, index, array) => {
    const previousNode = array[index - 1];

    if (node.type.id === Selector) {
      response += indent(1) + selector;
    }

    if (node.type.id === PipelineExpr) {
      response += indentMultiline(pipeline, 1);
    }

    if (node.type.id === Range) {
      response += '\n' + indent(1) + range;
    }

    if (node.type.id === OffsetExpr) {
      response += ' ' + offset;
    }

    if (node.type.id === UnwrapExpr) {
      if (previousNode?.type.id !== OffsetExpr && previousNode?.type.id !== Range) {
        response += '\n' + indent(0.5) + unwrap;
      } else {
        response += ' ' + unwrap;
      }
    }
  });

  return (response += '\n)');
}

function formatGrouping(node: SyntaxNode, query: string): string {
  let response = '';

  const labels = iterateNode(node, [Identifier]).map((node) => {
    return query.substring(node.from, node.to);
  });

  iterateNode(node, [By, Without]).forEach((node) => {
    if (node.parent?.type.id !== Grouping) {
      return;
    }

    switch (node.type.id) {
      case By:
        response = ` by(${labels.join(', ')})`;
        break;

      case Without:
        response = ` without(${labels.join(', ')})`;
        break;
    }
  });

  return response;
}

function formatVectorAggregationExpr(node: SyntaxNode, query: string): string {
  let response = '';

  iterateNode(node, [VectorOp, Number, MetricExpr, Grouping]).forEach((node, _, arr) => {
    if (node.parent?.type.id !== VectorAggregationExpr) {
      return;
    }

    switch (node.type.id) {
      case VectorOp:
        response += `${query.substring(node.from, node.to)}`;
        break;

      case Number:
        response += `(\n`;
        response += `${indent(1) + query.substring(node.from, node.to)},\n`;
        break;

      case MetricExpr:
        const hasNumber = arr.find((node) => node.type.id === Number && node.parent?.type.id === VectorAggregationExpr);
        response += hasNumber ? '' : '(\n';

        const metricExpr = query.substring(node.from, node.to);
        response += indentMultiline(formatMetricExpr({ from: 0, to: metricExpr.length } as SyntaxNode, metricExpr), 1);
        response += '\n)';
        break;

      case Grouping:
        response += formatGrouping(node, query);
        break;
    }
  });

  return response;
}

function formatBinOpExpr(node: SyntaxNode, query: string): string {
  let operator: string | undefined;

  const [leftExpr, rightExpr] = iterateNode(node, [Expr]).map((node, idx) => {
    if (idx === 0) {
      operator = query.substring(node.nextSibling?.from ?? 0, node.nextSibling?.to);
    }

    return formatLokiQuery(query.substring(node.from, node.to));
  });

  console.log(leftExpr + '\n' + operator + '\n' + rightExpr);
  return leftExpr + '\n' + operator + '\n' + rightExpr;
}

/* 
the functions below are used to format log queries
*/

const formatLogExpr = (node: SyntaxNode, query: string): string => {
  const tree = parser.parse(query.substring(node.from, node.to));
  let formatted = '';

  tree.iterate({
    enter: (ref): void => {
      const node = ref.node;

      switch (node.type.id) {
        case Selector:
          formatted += formatSelector(node, query);
          break;

        case PipelineExpr:
          node.parent?.type.id !== PipelineExpr && (formatted += formatPipelineExpr(node, query));
          break;
      }
    },
  });

  return formatted;
};

function formatSelector(node: SyntaxNode, query: string): string {
  const selector = query.substring(node.from, node.to);
  const subtree = parser.parse(selector);
  const labelNodes: SyntaxNode[] = [];
  let response = '';

  subtree.iterate({
    enter: (ref): void => {
      const node = ref.node;
      if (node.type.id === Matcher) {
        labelNodes.push(node);
      }
    },
  });

  labelNodes.sort((a, b) => {
    const labelNodeA = a.getChild(Identifier);
    const labelNodeB = b.getChild(Identifier);

    const labelValueA = labelNodeA && query.substring(labelNodeA.from, labelNodeA.to);
    const labelValueB = labelNodeB && query.substring(labelNodeB.from, labelNodeB.to);

    if (!labelValueA || !labelValueB) {
      return 0;
    }

    if (labelValueA < labelValueB) {
      return -1;
    }

    if (labelValueA > labelValueB) {
      return 1;
    }

    return 0;
  });

  labelNodes.forEach((node) => {
    const labelNode = node.getChild(Identifier);
    const operatorNode = labelNode ? labelNode.nextSibling : null;
    const valueNode = node.getChild(String);

    const label = labelNode ? query.substring(labelNode.from, labelNode.to) : null;
    const operator = operatorNode ? query.substring(operatorNode.from, operatorNode.to) : null;
    const value = valueNode ? query.substring(valueNode.from, valueNode.to) : null;

    response += `${label}${operator}${value}, `;
  });

  return '{' + trimEnd(response, ', ') + '}';
}

function formatPipelineExpr(node: SyntaxNode, query: string): string {
  const pipelineExprNodes = [
    LineFilter,
    LabelParser,
    LabelFilter,
    JsonExpressionParser,
    LineFormatExpr,
    LabelFormatExpr,
    LineComment,
  ];
  let lastPipelineType: number;
  let response = '';

  iterateNode(node, pipelineExprNodes).forEach((node) => {
    switch (node.type.id) {
      case LineFilter:
        response += buildResponse(LineFilter, lastPipelineType, formatLineFilter(node, query));
        lastPipelineType = LineFilter;
        break;

      case LabelParser:
        response += buildResponse(LabelParser, lastPipelineType, formatLabelParser(node, query));
        lastPipelineType = LabelParser;
        break;

      case JsonExpressionParser:
        response += buildResponse(JsonExpressionParser, lastPipelineType, formatJsonExpressionParser(node, query));
        lastPipelineType = JsonExpressionParser;
        break;

      case LabelFilter:
        response += buildResponse(LabelFilter, lastPipelineType, formatLabelFilter(node, query));
        lastPipelineType = LabelFilter;
        break;

      case LineFormatExpr:
        response += buildResponse(LineFormatExpr, lastPipelineType, formatLineFormatExpr(node, query));
        lastPipelineType = LineFormatExpr;
        break;

      case LabelFormatExpr:
        response += buildResponse(LabelFormatExpr, lastPipelineType, formatLabelFormatExpr(node, query));
        lastPipelineType = LabelFormatExpr;
        break;

      case LineComment:
        response += buildResponse(LineComment, lastPipelineType, formatLineComment(node, query));
        lastPipelineType = LineComment;
        break;
    }
  });

  return response;
}

function formatLineFilter(node: SyntaxNode, query: string): string {
  const filterNode = node.getChild(Filter);
  const filterOperationNode = node.getChild(FilterOp);
  const stringNode = node.getChild(String);

  const filter = filterNode && query.substring(filterNode.from, filterNode.to);
  const string = stringNode && query.substring(stringNode.from, stringNode.to);

  if (filterOperationNode) {
    return `${filter} ip(${string})`;
  }
  return `${filter} ${string}`;
}

function formatLabelParser(node: SyntaxNode, query: string): string {
  const hasString = node.getChild(String);

  if (hasString) {
    const parserNode = node.getChild(Regexp) || node.getChild(Pattern);
    const stringNode = node.getChild(String);

    const parser = parserNode && query.substring(parserNode.from, parserNode.to);
    const string = stringNode && query.substring(stringNode.from, stringNode.to);

    return `| ${parser}${string}`;
  }

  const labelParser = query.substring(node.from, node.to);
  return `| ${labelParser}`;
}

function formatJsonExpressionParser(node: SyntaxNode, query: string): string {
  const jsonExpressionNodes = iterateNode(node, [JsonExpression]);
  let response = '';

  jsonExpressionNodes.forEach((node) => {
    const identifierNode = node.getChild(Identifier);
    const valueNode = node.getChild(String);

    const identifier = identifierNode && query.substring(identifierNode.from, identifierNode.to);
    const value = valueNode && query.substring(valueNode.from, valueNode.to);

    response += `${identifier}=${value}, `;
  });

  return `| json ${trimEnd(response, ', ')}`;
}

function formatLabelFilter(node: SyntaxNode, query: string): string {
  const selectedFilter =
    node.getChild(Matcher) ||
    node.getChild(IpLabelFilter) ||
    node.getChild(NumberFilter) ||
    node.getChild(UnitFilter)?.getChild(DurationFilter) ||
    node.getChild(UnitFilter)?.getChild(BytesFilter);

  if (!selectedFilter) {
    return '';
  }

  const selectedFilterType = selectedFilter.type.id;

  const identifierNode = selectedFilter.getChild(Identifier);
  const operatorNode = identifierNode && identifierNode.nextSibling;
  let valueNode: SyntaxNode | null | undefined;

  if (selectedFilterType === DurationFilter) {
    valueNode = selectedFilter.getChild(Duration);
  } else if (selectedFilterType === BytesFilter) {
    valueNode = selectedFilter.getChild(Bytes);
  } else if (selectedFilterType === NumberFilter) {
    valueNode = selectedFilter.getChild(Number);
  } else {
    valueNode = selectedFilter.getChild(String);
  }

  const identifier = identifierNode && query.substring(identifierNode.from, identifierNode.to);
  const operator = operatorNode && query.substring(operatorNode.from, operatorNode.to);
  const value = valueNode && query.substring(valueNode.from, valueNode.to);

  if (selectedFilterType === IpLabelFilter) {
    return `| ${identifier}${operator}ip(${value})`;
  }

  return `| ${identifier}${operator}${value}`;
}

function formatLineFormatExpr(node: SyntaxNode, query: string): string {
  const stringNode = node.getChild(String);
  const string = stringNode && query.substring(stringNode.from, stringNode.to);
  return `| line_format ${string}`;
}

function formatLabelFormatExpr(node: SyntaxNode, query: string): string {
  const labelFormatMatcherNodes = iterateNode(node, [LabelFormatMatcher]);
  let response = '| label_format ';

  labelFormatMatcherNodes.forEach((labelFormatMatcherNode) => {
    let identifierNode: SyntaxNode | null;
    let valueNode: SyntaxNode | null;

    if (labelFormatMatcherNode.getChildren(Identifier).length === 2) {
      [identifierNode, valueNode] = labelFormatMatcherNode.getChildren(Identifier);
    } else {
      identifierNode = labelFormatMatcherNode.getChild(Identifier);
      valueNode = labelFormatMatcherNode.getChild(String);
    }

    const identifier = identifierNode && query.substring(identifierNode.from, identifierNode.to);
    const value = valueNode && query.substring(valueNode.from, valueNode.to);

    response += `${identifier}=${value}, `;
  });

  return trimEnd(response, ', ');
}

function formatLineComment(node: SyntaxNode, query: string): string {
  let comment = query.substring(node.from, node.to);
  return comment.replace(/^# */, '# ').trim();
}

/* 
the functions below are utilities for log and metric queries
*/

function indent(level: number): string {
  return '  '.repeat(level);
}

function indentMultiline(block: string, level: number): string {
  const lines = block.split('\n');
  return lines.map((line) => indent(level) + line).join('\n');
}

function iterateNode(node: SyntaxNode, lookingFor: number[]): SyntaxNode[] {
  const nodes: SyntaxNode[] = [];
  let child = node.firstChild;

  while (child) {
    if (lookingFor.includes(child.type.id)) {
      nodes.push(child);
    }

    nodes.push(...iterateNode(child, lookingFor));
    child = child.nextSibling;
  }

  return nodes;
}

function buildResponse(pipelineType: number, lastPipelineType: number, formattedNode: string): string {
  if (pipelineType === LineComment) {
    return `\n${indent(1)}${formattedNode}`;
  }

  if (lastPipelineType === pipelineType) {
    return ` ${formattedNode}`;
  }

  return `\n${indent(1)}${formattedNode}`;
}

function transformVariablesToValue(query: string): { transformedQuery: string; transformations: TypedVariableModel[] } {
  const variables = getTemplateSrv().getVariables();
  const transformations: TypedVariableModel[] = [];

  variables.forEach((variable) => {
    if (variable.type === 'query') {
      const replaceRegex = new RegExp(`\\$${variable.name}`, 'g');
      const replacedQuery = query.replace(replaceRegex, variable.current.value as string);

      if (replacedQuery !== query) {
        query = replacedQuery;
        transformations.push(variable);
      }
    }

    if (variable.type === 'constant') {
      const replaceRegex = new RegExp(`\\$${variable.name}`, 'g');
      const replacedQuery = query.replace(replaceRegex, variable.current.value as string);

      if (replacedQuery !== query) {
        query = replacedQuery;
        transformations.push(variable);
      }
    }

    if (variable.type === 'custom') {
      const replaceRegex = new RegExp(`\\$${variable.name}`, 'g');
      const replacedQuery = query.replace(replaceRegex, variable.current.value as string);

      if (replacedQuery !== query) {
        query = replacedQuery;
        transformations.push(variable);
      }
    }

    if (variable.type === 'textbox') {
      const replaceRegex = new RegExp(`\\$${variable.name}`, 'g');
      let replacedQuery = '';

      if (variable.current.value) {
        replacedQuery = query.replace(replaceRegex, variable.current.value as string);
      } else {
        replacedQuery = query.replace(replaceRegex, variable.query);
      }

      if (replacedQuery !== query) {
        query = replacedQuery;
        transformations.push(variable);
      }
    }

    if (variable.type === 'interval') {
      const replaceRegex = new RegExp(`\\$${variable.name}`, 'g');
      const replacedQuery = query.replace(replaceRegex, variable.current.value as string);

      if (replacedQuery !== query) {
        query = replacedQuery;
        transformations.push(variable);
      }
    }

    if (variable.type === 'adhoc') {
    }
  });

  return { transformedQuery: query, transformations };
}

function transformValuesToVariables(query: string, transformations: TypedVariableModel[]): string {
  transformations.forEach((variable) => {
    if (variable.type === 'query') {
      const replaceRegex = new RegExp(variable.current.value as string, 'g');
      query = query.replace(replaceRegex, `$${variable.name}`);
    }

    if (variable.type === 'constant') {
      const replaceRegex = new RegExp(variable.current.value as string, 'g');
      query = query.replace(replaceRegex, `$${variable.name}`);
    }

    if (variable.type === 'custom') {
      const replaceRegex = new RegExp(variable.current.value as string, 'g');
      query = query.replace(replaceRegex, `$${variable.name}`);
    }

    if (variable.type === 'textbox') {
      let replaceRegex: RegExp;

      if (variable.current.value) {
        replaceRegex = new RegExp(variable.current.value as string, 'g');
      } else {
        replaceRegex = new RegExp(variable.query as string, 'g');
      }

      query = query.replace(replaceRegex, `$${variable.name}`);
    }

    if (variable.type === 'interval') {
      const replaceRegex = new RegExp(variable.current.value as string, 'g');
      query = query.replace(replaceRegex, `$${variable.name}`);
    }

    if (variable.type === 'adhoc') {
    }
  });

  return query;
}
