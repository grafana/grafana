import { SyntaxNode } from '@lezer/common';
import { trimEnd } from 'lodash';

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
  VectorExpr,
  VectorOp,
  Add,
  Sub,
  DecolorizeExpr,
  DistinctFilter,
} from '@grafana/lezer-logql';

import { replaceVariables, returnVariables } from '../prometheus/querybuilder/shared/parsingUtils';

import { isValidQuery } from './queryUtils';

export const formatLokiQuery = (query: string): string => {
  let transformedQuery = replaceVariables(query);
  let formatted = '';
  const tree = parser.parse(transformedQuery);
  const transformationMatches = [];

  // replaceVariables(query) converts $interval_variable to a format similar to __V_0__text__V__
  // however lezer does not support __V_0__text__V__ so we need to replace it with [0s] to make it valid
  if (tree.topNode.firstChild?.firstChild?.type.id === MetricExpr) {
    const pattern = /\[__V_[0-2]__\w+__V__\]/g;
    transformationMatches.push(...transformedQuery.matchAll(pattern));
    transformedQuery = transformedQuery.replace(pattern, '[0s]');
  }

  if (isValidQuery(transformedQuery) === false) {
    return query;
  }

  const newTree = parser.parse(transformedQuery);
  newTree.iterate({
    enter: (ref): false | void => {
      const node = ref.node;

      if (node.parent?.type.id !== Expr || node.parent?.parent?.type.id === BinOpExpr) {
        return;
      }

      switch (node.type.id) {
        case MetricExpr:
          formatted = formatMetricExpr(node, transformedQuery);
          return false;

        case LogExpr:
          formatted = formatLogExpr(node, transformedQuery);
          return false;
      }
    },
  });

  if (tree.topNode.firstChild?.firstChild?.type.id === MetricExpr) {
    transformationMatches.forEach((match) => {
      formatted = formatted.replace('[0s]', match[0]);
    });
  }

  return trimMultiline(returnVariables(formatted));
};

// TODO:
//   - fix (nested vector expr): count(sum(rate({compose_project="tns-custom"}[1s])))
//   - support: LabelReplaceExpr
//   - support: LineComment

/* 
the functions below are used to format metric queries
*/

const formatMetricExpr = (node: SyntaxNode, query: string): string => {
  const { addBrackets, newNode } = needsBrackets(node, MetricExpr);
  node = newNode;
  let formatted = '';

  const childNode = node.firstChild;
  switch (childNode && childNode.type.id) {
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
      formatted = formatLiteralExpr(node, query);
      break;

    case VectorExpr:
      formatted = formatVectorExpr(node, query);
      break;
  }

  return addBrackets ? '(' + formatted + ')' : formatted;
};

export function formatRangeAggregationExpr(node: SyntaxNode, query: string): string {
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
        response += `${indent(1) + query.substring(node.from, node.to)},\n`;
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

export function formatLogRangeExpr(node: SyntaxNode, query: string): string {
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
        selector += formatSelector({ ...node, from: 0, to: logExpr.length }, logExpr);
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
        iterateNode(node, [Identifier, ConvOp, LabelFilter]).forEach((node, _, arr) => {
          switch (node.type.id) {
            case Identifier:
              if (node.parent?.type.id !== UnwrapExpr) {
                return;
              }

              const hasConvOp = arr.find((node) => node.type.id === ConvOp);

              if (hasConvOp) {
                return;
              }

              unwrap += `| unwrap ${query.substring(node.from, node.to)} `;
              return;

            case ConvOp:
              const identifierNode = arr.find((node) => node.type.id === Identifier);
              const identifier = identifierNode ? query.substring(identifierNode.from, identifierNode.to) : '';
              unwrap += `| unwrap ${query.substring(node.from, node.to)}(${identifier}) `;
              return;

            case LabelFilter:
              unwrap += formatLabelFilter(node, query);
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
      response += offset;
    }

    if (node.type.id === UnwrapExpr) {
      if (previousNode?.type.id !== OffsetExpr && previousNode?.type.id !== Range) {
        response += '\n' + indent(1) + unwrap;
      } else {
        response += ' ' + unwrap;
      }
    }
  });

  return (response += '\n)');
}

export function formatGrouping(node: SyntaxNode, query: string): string {
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
        response = ` by (${labels.join(', ')}) `;
        break;

      case Without:
        response = ` without (${labels.join(', ')}) `;
        break;
    }
  });

  return response;
}

export function formatVectorAggregationExpr(node: SyntaxNode, query: string): string {
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
        response += indentMultiline(formatLokiQuery(metricExpr), 1);
        response += '\n)';
        break;

      case Grouping:
        response += formatGrouping(node, query);
        break;
    }
  });

  return response;
}

export function formatBinOpExpr(node: SyntaxNode, query: string): string {
  let operator: string | undefined;

  const [leftExpr, rightExpr] = iterateNode(node, [Expr]).map((node, idx) => {
    if (idx === 0) {
      operator = query.substring(node.nextSibling?.from ?? 0, node.nextSibling?.to);
    }

    return formatLokiQuery(query.substring(node.from, node.to));
  });

  return leftExpr + '\n' + operator + '\n' + rightExpr;
}

export function formatLiteralExpr(node: SyntaxNode, query: string): string {
  node = node.getChild(LiteralExpr) ?? node;
  const addNode = node.getChild(Add);
  const subNode = node.getChild(Sub);
  const numberNode = node.getChild(Number);

  if (!numberNode) {
    return '';
  }

  if (addNode) {
    return `+${query.substring(numberNode.from, numberNode.to)}`;
  }

  if (subNode) {
    return `-${query.substring(numberNode.from, numberNode.to)}`;
  }

  return query.substring(numberNode.from, numberNode.to);
}

export function formatVectorExpr(node: SyntaxNode, query: string): string {
  node = node.getChild(VectorExpr) ?? node;
  const numberNode = node.getChild(Number);

  if (!numberNode) {
    return '';
  }

  return `vector(${query.substring(numberNode.from, numberNode.to)})`;
}

/* 
the functions below are used to format log queries
*/

const formatLogExpr = (node: SyntaxNode, query: string): string => {
  const { addBrackets, newNode } = needsBrackets(node, LogExpr);
  node = newNode;

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

  return addBrackets ? '(' + formatted + ')' : formatted;
};

export function formatSelector(node: SyntaxNode, query: string): string {
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

export function formatPipelineExpr(node: SyntaxNode, query: string): string {
  const pipelineExprNodes = [
    LineFilter,
    LabelParser,
    LabelFilter,
    JsonExpressionParser,
    LineFormatExpr,
    LabelFormatExpr,
    DistinctFilter,
    DecolorizeExpr,
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

      case DistinctFilter:
        response += buildResponse(DistinctFilter, lastPipelineType, formatDistinctFilter(node, query));
        lastPipelineType = DistinctFilter;
        break;

      case DecolorizeExpr:
        response += buildResponse(DecolorizeExpr, lastPipelineType, formatDecolorizeExpr(node, query));
        lastPipelineType = DecolorizeExpr;
        break;
    }
  });

  return response;
}

export function formatLineFilter(node: SyntaxNode, query: string): string {
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

export function formatLabelParser(node: SyntaxNode, query: string): string {
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

export function formatJsonExpressionParser(node: SyntaxNode, query: string): string {
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

export function formatLabelFilter(node: SyntaxNode, query: string): string {
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

export function formatLineFormatExpr(node: SyntaxNode, query: string): string {
  const stringNode = node.getChild(String);
  const string = stringNode && query.substring(stringNode.from, stringNode.to);
  return `| line_format ${string}`;
}

export function formatLabelFormatExpr(node: SyntaxNode, query: string): string {
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

export function formatDistinctFilter(node: SyntaxNode, query: string): string {
  const identifierNodes = iterateNode(node, [Identifier]);
  const identifiers = identifierNodes.map((identifierNode) => query.substring(identifierNode.from, identifierNode.to));
  return `| distinct ${identifiers.join(', ')}`;
}

export function formatDecolorizeExpr(node: SyntaxNode, query: string): string {
  return `| decolorize`;
}

/* 
the functions below are utilities for log and metric queries
*/

export function indent(level: number): string {
  return '  '.repeat(level);
}

export function indentMultiline(block: string, level: number): string {
  const lines = block.split('\n');
  return lines.map((line) => indent(level) + line).join('\n');
}

export function trimMultiline(block: string): string {
  const lines = block.split('\n');
  return lines.map((line) => line.trimEnd()).join('\n');
}

export function needsBrackets(node: SyntaxNode, queryType: number): { addBrackets: boolean; newNode: SyntaxNode } {
  const childNodeIsSame = node.firstChild?.type.id === queryType;
  let addBrackets = false;

  if (node.firstChild && childNodeIsSame) {
    addBrackets = true;
    node = node.firstChild;
  }

  return { addBrackets, newNode: node };
}

export function iterateNode(node: SyntaxNode, lookingFor: number[]): SyntaxNode[] {
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

export function buildResponse(pipelineType: number, lastPipelineType: number, formattedNode: string): string {
  if (pipelineType === LineComment) {
    return `\n${indent(1)}${formattedNode}`;
  }

  if (lastPipelineType === pipelineType) {
    return ` ${formattedNode}`;
  }

  return `\n${indent(1)}${formattedNode}`;
}
