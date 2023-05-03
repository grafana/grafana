import { SyntaxNode } from '@lezer/common';
import { trimEnd } from 'lodash';

import {
  Eq,
  Identifier,
  String,
  LogExpr,
  Matcher,
  parser,
  PipelineExpr,
  Selector,
  Nre,
  Re,
  Neq,
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
  Gtr,
  Gte,
  Lss,
  Lte,
  Eql,
  Duration,
  Bytes,
  Number,
  LabelFormatMatcher,
  FilterOp,
} from '@grafana/lezer-logql';

export const formatLogQL = (query: string): string => {
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

export function formatSelector(node: SyntaxNode, query: string): string {
  const selector = query.substring(node.from, node.to);
  const subtree = parser.parse(selector);
  const labelNodes: SyntaxNode[] = [];
  let response = '';

  // get all label nodes from the selector
  subtree.iterate({
    enter: (ref): void => {
      const node = ref.node;
      if (node.type.id === Matcher) {
        labelNodes.push(node);
      }
    },
  });

  // sort the label nodes in alphabetical order
  labelNodes.sort((a, b) => {
    const LabelNodeA = a.getChild(Identifier)!;
    const LabelNodeB = b.getChild(Identifier)!;

    const labelValueA = query.substring(LabelNodeA.from, LabelNodeA.to);
    const labelValueB = query.substring(LabelNodeB.from, LabelNodeB.to);

    if (labelValueA < labelValueB) {
      return -1;
    }
    if (labelValueA > labelValueB) {
      return 1;
    }
    return 0;
  });

  // add the formatted label to the response
  labelNodes.forEach((node) => {
    const labelNode = node.getChild(Identifier)!;
    const valueNode = node.getChild(String)!;
    let operatorNode: SyntaxNode;

    if (node.getChild(Eq)) {
      operatorNode = node.getChild(Eq)!;
    } else if (node.getChild(Neq)) {
      operatorNode = node.getChild(Neq)!;
    } else if (node.getChild(Re)) {
      operatorNode = node.getChild(Re)!;
    } else {
      operatorNode = node.getChild(Nre)!;
    }

    const label = query.substring(labelNode.from, labelNode.to);
    const operator = query.substring(operatorNode.from, operatorNode.to);
    const value = query.substring(valueNode.from, valueNode.to);

    response += `${label}${operator}${value}, `;
  });

  // remove the trailing comma and return the formatted selector
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

export function formatLineFilter(node: SyntaxNode, query: string): string {
  const filterNode = node.getChild(Filter)!;
  const filterOperation = node.getChild(FilterOp);
  const stringNode = node.getChild(String)!;

  const filter = query.substring(filterNode.from, filterNode.to);
  const string = query.substring(stringNode.from, stringNode.to);

  if (filterOperation) {
    return `${filter} ip(${string})`;
  }
  return `${filter} ${string}`;
}

export function formatLabelParser(node: SyntaxNode, query: string): string {
  const hasString = node.getChild(String);

  if (hasString) {
    const parserNode = (node.getChild(Regexp) || node.getChild(Pattern))!;
    const stringNode = node.getChild(String)!;

    const parser = query.substring(parserNode.from, parserNode.to);
    const string = query.substring(stringNode.from, stringNode.to);

    return `| ${parser}${string}`;
  }

  const labelParser = query.substring(node.from, node.to);
  return `| ${labelParser}`;
}

export function formatJsonExpressionParser(node: SyntaxNode, query: string): string {
  const jsonExpressionNodes = iterateNode(node, [JsonExpression]);
  let response = '';

  jsonExpressionNodes.forEach((node) => {
    const identifierNode = node.getChild(Identifier)!;
    const valueNode = node.getChild(String)!;

    const identifier = query.substring(identifierNode.from, identifierNode.to);
    const value = query.substring(valueNode.from, valueNode.to);

    response += `${identifier}=${value}, `;
  });

  return `| json ${trimEnd(response, ', ')}`;
}

export function formatLabelFilter(node: SyntaxNode, query: string): string {
  if (node.getChild(Matcher)) {
    const matcherNode = node.getChild(Matcher)!;

    const identifierNode = matcherNode.getChild(Identifier)!;
    const valueNode = matcherNode.getChild(String)!;
    const identifier = query.substring(identifierNode.from, identifierNode.to);
    const value = query.substring(valueNode.from, valueNode.to);

    if (matcherNode.getChild(Eq)) {
      return `| ${identifier}=${value}`;
    } else if (matcherNode.getChild(Neq)) {
      return `| ${identifier}!=${value}`;
    } else if (matcherNode.getChild(Re)) {
      return `| ${identifier}=~${value}`;
    } else if (matcherNode.getChild(Nre)) {
      return `| ${identifier}!~${value}`;
    }
  }

  if (node.getChild(IpLabelFilter)) {
    const ipLabelFilterNode = node.getChild(IpLabelFilter)!;

    const identifierNode = ipLabelFilterNode.getChild(Identifier)!;
    const valueNode = ipLabelFilterNode.getChild(String)!;
    const identifier = query.substring(identifierNode.from, identifierNode.to);
    const value = query.substring(valueNode.from, valueNode.to);

    if (ipLabelFilterNode.getChild(Eq)) {
      return `| ${identifier}=ip(${value})`;
    } else if (ipLabelFilterNode.getChild(Neq)) {
      return `| ${identifier}!=ip(${value})`;
    }
  }

  if (node.getChild(UnitFilter) && node.getChild(UnitFilter)!.getChild(DurationFilter)) {
    const subNode = node.getChild(UnitFilter)!;
    const durationFilterNode = subNode.getChild(DurationFilter)!;

    const identifierNode = durationFilterNode.getChild(Identifier)!;
    const valueNode = durationFilterNode.getChild(Duration)!;
    const identifier = query.substring(identifierNode.from, identifierNode.to);
    const value = query.substring(valueNode.from, valueNode.to);

    if (durationFilterNode.getChild(Gtr)) {
      return `| ${identifier}>${value}`;
    } else if (durationFilterNode.getChild(Gte)) {
      return `| ${identifier}>=${value}`;
    } else if (durationFilterNode.getChild(Lss)) {
      return `| ${identifier}<${value}`;
    } else if (durationFilterNode.getChild(Lte)) {
      return `| ${identifier}<=${value}`;
    } else if (durationFilterNode.getChild(Neq)) {
      return `| ${identifier}!=${value}`;
    } else if (durationFilterNode.getChild(Eq)) {
      return `| ${identifier}=${value}`;
    } else if (durationFilterNode.getChild(Eql)) {
      return `| ${identifier}==${value}`;
    }
  }

  if (node.getChild(UnitFilter) && node.getChild(UnitFilter)!.getChild(BytesFilter)) {
    const subNode = node.getChild(UnitFilter)!;
    const bytesFilterNode = subNode.getChild(BytesFilter)!;

    const identifierNode = bytesFilterNode.getChild(Identifier)!;
    const valueNode = bytesFilterNode.getChild(Bytes)!;
    const identifier = query.substring(identifierNode.from, identifierNode.to);
    const value = query.substring(valueNode.from, valueNode.to);

    if (bytesFilterNode.getChild(Gtr)) {
      return `| ${identifier}>${value}`;
    } else if (bytesFilterNode.getChild(Gte)) {
      return `| ${identifier}>=${value}`;
    } else if (bytesFilterNode.getChild(Lss)) {
      return `| ${identifier}<${value}`;
    } else if (bytesFilterNode.getChild(Lte)) {
      return `| ${identifier}<=${value}`;
    } else if (bytesFilterNode.getChild(Neq)) {
      return `| ${identifier}!=${value}`;
    } else if (bytesFilterNode.getChild(Eq)) {
      return `| ${identifier}=${value}`;
    } else if (bytesFilterNode.getChild(Eql)) {
      return `| ${identifier}==${value}`;
    }
  }

  if (node.getChild(NumberFilter)) {
    const numberFilterNode = node.getChild(NumberFilter)!;

    const identifierNode = numberFilterNode.getChild(Identifier)!;
    const valueNode = numberFilterNode.getChild(Number)!;
    const identifier = query.substring(identifierNode.from, identifierNode.to);
    const value = query.substring(valueNode.from, valueNode.to);

    if (numberFilterNode.getChild(Gtr)) {
      return `| ${identifier}>${value}`;
    } else if (numberFilterNode.getChild(Gte)) {
      return `| ${identifier}>=${value}`;
    } else if (numberFilterNode.getChild(Lss)) {
      return `| ${identifier}<${value}`;
    } else if (numberFilterNode.getChild(Lte)) {
      return `| ${identifier}<=${value}`;
    } else if (numberFilterNode.getChild(Neq)) {
      return `| ${identifier}!=${value}`;
    } else if (numberFilterNode.getChild(Eq)) {
      return `| ${identifier}=${value}`;
    } else if (numberFilterNode.getChild(Eql)) {
      return `| ${identifier}==${value}`;
    }
  }

  return '';
}

export function formatLineFormatExpr(node: SyntaxNode, query: string): string {
  const stringNode = node.getChild(String)!;
  const string = query.substring(stringNode.from, stringNode.to);
  return `| line_format ${string}`;
}

export function formatLabelFormatExpr(node: SyntaxNode, query: string): string {
  const labelFormatMatcherNodes = iterateNode(node, [LabelFormatMatcher]);
  let response = '| label_format ';

  labelFormatMatcherNodes.forEach((labelFormatMatcherNode) => {
    if (labelFormatMatcherNode.getChildren(Identifier).length === 2) {
      const [identifierNode, valueNode] = labelFormatMatcherNode.getChildren(Identifier);
      const identifier = query.substring(identifierNode.from, identifierNode.to);
      const value = query.substring(valueNode.from, valueNode.to);
      response += `${identifier}=${value}, `;
      return;
    }

    const identifierNode = labelFormatMatcherNode.getChild(Identifier)!;
    const valueNode = labelFormatMatcherNode.getChild(String)!;
    const identifier = query.substring(identifierNode.from, identifierNode.to);
    const value = query.substring(valueNode.from, valueNode.to);
    response += `${identifier}=${value}, `;
    return;
  });

  return trimEnd(response, ', ');
}

export function formatLineComment(node: SyntaxNode, query: string): string {
  let comment = query.substring(node.from, node.to);
  return comment.replace(/^# */, '# ').trim();
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
    return `\n  ${formattedNode}`;
  }

  if (lastPipelineType === pipelineType) {
    return ` ${formattedNode}`;
  }

  return `\n  ${formattedNode}`;
}
