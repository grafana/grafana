import { SyntaxNode } from '@lezer/common';
import { trimEnd } from 'lodash';

import {
  Eq,
  JsonExpression,
  JsonExpressionParser,
  LabelFilter,
  LabelFormatExpr,
  LabelParser,
  LineComment,
  LineFilter,
  LineFilters,
  LineFormatExpr,
  LogExpr,
  Matcher,
  Neq,
  Nre,
  parser,
  PipelineExpr,
  PipelineStage,
  Re,
  Selector,
  String,
} from '@grafana/lezer-logql';

// the way i currently reconstruct the query is temporary, i would like to find a better way to do this.
// i have only focused on log queries, once i have a good idea of how to solution will look, i will add metric.
export const formatLogQL = (query: string): string => {
  query = query.replace(/\n/g, '').trim();
  const tree = parser.parse(query);
  let formatted = '';

  tree.iterate({
    enter: (ref): void => {
      const node = ref.node;

      switch (node.type.id) {
        case Selector:
          formatted += formatSelector(node, query);
          break;
        case PipelineExpr:
          node.parent?.type.id === LogExpr && (formatted += formatPipelineExpr(node, query));
          break;
      }
    },
  });

  return formatted;
};

// we could take this opportunity to order the labels, would this improve cache hits?
// (maybe not, i don't have context around caching i just remember this was mentioned)
function formatSelector(node: SyntaxNode, query: string): string {
  const selector = query.substring(node.from, node.to);
  const subtree = parser.parse(selector);
  const labelNodes: SyntaxNode[] = [];
  let output = '';

  subtree.iterate({
    enter: (ref): void => {
      const node = ref.node;
      if (node.type.id === Matcher) {
        labelNodes.push(node);
      }
    },
  });

  labelNodes.forEach((labelNode) => {
    const label = selector.substring(labelNode.from, labelNode.to);
    output += `${label}, `;
  });

  return '{' + trimEnd(output, ', ') + '}';
}

function formatPipelineExpr(node: SyntaxNode, query: string): string {
  const pipelineExpr = query.substring(node.from, node.to);
  const validQueryExpr = '{}' + pipelineExpr;
  const subtree = parser.parse(validQueryExpr);

  let lastPipelineType: number;
  let response = '';

  subtree.iterate({
    enter: (ref): void => {
      const node = ref.node;
      const child = node.lastChild?.type.id;

      if (node.type.id === PipelineStage) {
        switch (child) {
          // |= "foo"
          case LineFilters:
            response += formatLineFilters(node.lastChild!, validQueryExpr);
            lastPipelineType = LineFilters;
            break;

          // | logfmt
          case LabelParser:
            const formattedLabelParser = formatLabelParser(node.lastChild!, validQueryExpr);
            response += buildResponse(LabelParser, lastPipelineType, formattedLabelParser);
            lastPipelineType = LabelParser;
            break;

          // | foo = "bar"
          case LabelFilter:
            const formattedLabelFilter = formatLabelFilter(node.lastChild!, validQueryExpr);
            response += buildResponse(LabelFilter, lastPipelineType, formattedLabelFilter);
            lastPipelineType = LabelFilter;
            break;

          // | json foo="bar"
          case JsonExpressionParser:
            const formattedJsonExpressionParser = formatJsonExpression(node.lastChild!, validQueryExpr);
            response += buildResponse(JsonExpressionParser, lastPipelineType, formattedJsonExpressionParser);
            lastPipelineType = JsonExpressionParser;
            break;

          // | line_format "{{.log}}"
          case LineFormatExpr:
            const formattedLineFormatExpr = formatLineFormatExpr(node.lastChild!, validQueryExpr);
            response += buildResponse(LineFormatExpr, lastPipelineType, formattedLineFormatExpr);
            lastPipelineType = LineFormatExpr;
            break;

          // | label_format bar=foo
          case LabelFormatExpr:
            break;

          // # comment
          case LineComment:
            break;
        }
      }
    },
  });

  return response;
}

function buildResponse(pipelineType: number, lastPipelineType: number, formattedNode: string): string {
  if (lastPipelineType === pipelineType) {
    return ` ${formattedNode}`;
  }
  return `\n  ${formattedNode}`;
}

export function formatLineFilters(node: SyntaxNode, query: string): string {
  if (node.parent?.type.id !== PipelineStage) {
    return '';
  }

  const lineFilters = query.substring(node.from, node.to);
  const noErrorOnParse = '{} ' + lineFilters;
  const subtree = parser.parse(noErrorOnParse);
  const filterNodes: SyntaxNode[] = [];
  let output = `\n  `;

  subtree.iterate({
    enter: (ref): void => {
      const node = ref.node;

      if (node.type.id === LineFilter) {
        filterNodes.push(node);
      }
    },
  });

  filterNodes.forEach((filterNode) => {
    let filter = noErrorOnParse.substring(filterNode.from, filterNode.to);

    if (filter.startsWith('|=')) {
      filter = filter.replace(/\|= */, '|= ');
    } else if (filter.startsWith('!=')) {
      filter = filter.replace(/\!= */, '!= ');
    } else if (filter.startsWith('|~')) {
      filter = filter.replace(/\|~ */, '|~ ');
    } else if (filter.startsWith('!~')) {
      filter = filter.replace(/\!~ */, '!~ ');
    }

    output += `${filter} `;
  });

  return output;
}

export function formatLabelParser(node: SyntaxNode, query: string): string {
  const labelParsers = query.substring(node.from, node.to);
  return `| ${labelParsers}`;
}

export function formatLabelFilter(node: SyntaxNode, query: string): string {
  const labelFilter = query.substring(node.from, node.to);
  const matcherNode = node.getChild(Matcher)!;

  if (matcherNode.getChild(Eq)) {
    const items = labelFilter.split('=');
    const key = items[0].trim();
    const value = items[1].trim();
    return `| ${key} = ${value}`;
  }

  if (matcherNode.getChild(Neq)) {
    const items = labelFilter.split('!=');
    const key = items[0].trim();
    const value = items[1].trim();
    return `| ${key} != ${value}`;
  }

  if (matcherNode.getChild(Re)) {
    const items = labelFilter.split('=~');
    const key = items[0].trim();
    const value = items[1].trim();
    return `| ${key} =~ ${value}`;
  }

  if (matcherNode.getChild(Nre)) {
    const items = labelFilter.split('!~');
    const key = items[0].trim();
    const value = items[1].trim();
    return `| ${key} !~ ${value}`;
  }

  return '';
}

export function formatJsonExpression(node: SyntaxNode, query: string): string {
  const jsonExpression = '{}|' + query.substring(node.from, node.to);
  const subtree = parser.parse(jsonExpression);
  const jsonExpressionNodes: SyntaxNode[] = [];
  let output = '| json ';

  subtree.iterate({
    enter: (ref): void => {
      const node = ref.node;
      if (node.type.id === JsonExpression) {
        jsonExpressionNodes.push(node);
      }
    },
  });

  jsonExpressionNodes.forEach((jsonExpressionNode) => {
    const jsonExpressionn = jsonExpression.substring(jsonExpressionNode.from, jsonExpressionNode.to);
    output += `${jsonExpressionn}, `;
  });

  return trimEnd(output, ', ');
}

export function formatLineFormatExpr(node: SyntaxNode, query: string): string {
  const expressionString = node.getChild(String)!;
  const expression = query.substring(expressionString.from, expressionString.to);
  return `| line_format ${expression}`;
}

export function formatLabelFormatExpr(node: SyntaxNode, query: string): string {
  return '';
}

export function formatLineComment(node: SyntaxNode, query: string): string {
  return '';
}
