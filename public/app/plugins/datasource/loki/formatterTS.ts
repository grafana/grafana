import { SyntaxNode } from '@lezer/common';
import { trimEnd } from 'lodash';

import {
  LabelFilter,
  LabelParser,
  LineFilter,
  LineFilters,
  Matcher,
  parser,
  PipelineStage,
  Selector,
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
        case LineFilters:
          formatted += formatLineFilters(node, query);
          break;
        case LabelParser:
          formatted += formatLabelParser(node, query);
          break;
        case LabelFilter:
          formatted += formatLabelFilter(node, query);
      }
    },
  });

  return formatted;
};

const indentation = (level: number): string => '  '.repeat(level);

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

// getChild - getChildren
function formatLineFilters(node: SyntaxNode, query: string): string {
  if (node.parent?.type.id !== PipelineStage) {
    return '';
  }

  const lineFilters = query.substring(node.from, node.to);
  const noErrorOnParse = '{} ' + lineFilters;
  const subtree = parser.parse(noErrorOnParse);
  const filterNodes: SyntaxNode[] = [];
  let output = `\n${indentation(1)}`;

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

// need to update - label parsers should also be capable of having multiple on the same line "| logfmt | unpack | regex"
// right now each one will be on a new line.
function formatLabelParser(node: SyntaxNode, query: string): string {
  const labelParser = query.substring(node.from, node.to);
  console.log(labelParser);
  return `\n${indentation(1)}| ${labelParser}`;
}

function formatLabelFilter(node: SyntaxNode, query: string): string {
  const labelFilter = query.substring(node.from, node.to);
  const items = labelFilter.split('=');
  const key = items[0].trim();
  const value = items[1].trim();

  return `\n${indentation(1)}| ${key} = ${value}`;
}
