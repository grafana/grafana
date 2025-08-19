import { Grammar } from 'prismjs';

import { escapeRegex, parseFlags } from '@grafana/data';

import { LogListModel } from './processing';

// The Logs grammar is used for highlight in the logs panel
const logsGrammar: Grammar = {
  'log-token-json-key': /"(\b|\B)[\w-]+"(?=\s*:)/gi,
  'log-token-key': /(\b|\B)[\w_]+(?=\s*=)/gi,
  'log-token-string': /"(?!:)([^'"])*?"(?!:)/g,
};

const tokensGrammar: Grammar = {
  'log-token-uuid': /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/g,
  'log-token-size': /(?:\b|")\d+\.{0,1}\d*\s*[kKmMGgtTPp]*[bB]{1}(?:"|\b)/g,
  'log-token-duration': /(?:\b)\d+(\.\d+)?(ns|µs|ms|s|m|h|d)(?:\b)/g,
  'log-token-method': /\b(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|TRACE|CONNECT)\b/g,
};

const jsonGrammar: Grammar = {
  'log-token-json-key': {
    pattern: /(^|[^\\])"(?:\\.|[^\\"\r\n])*"(?=\s*:)/,
    lookbehind: true,
    greedy: true,
  },
  'log-token-string': {
    pattern: /(^|[^\\])"(?:\\.|[^\\"\r\n])*"(?!\s*:)/,
    lookbehind: true,
    greedy: true,
    inside: {
      ...tokensGrammar,
    }
  },
  'log-token-size': /-?\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/i,
  'punctuation': /[{}[\],]/,
  'operator': /:/,
  'boolean': /\b(?:false|true)\b/,
  'null': {
    pattern: /\bnull\b/,
    alias: 'keyword',
  },
}

export const generateLogGrammar = (log: LogListModel) => {
  const labels = Object.keys(log.labels).concat(log.fields.map((field) => field.keys[0]));
  const logGrammar: Grammar = {
    'log-token-label': new RegExp(`\\b(${labels.join('|')})(?:[=:]{1})\\b`, 'g'),
  };
  if (log.isJSON) {
    return {
      ...logGrammar,
      ...jsonGrammar,
    };
  }
  return {
    ...logGrammar,
    ...logsGrammar,
    ...tokensGrammar,
  };
};

export const generateTextMatchGrammar = (
  highlightWords: string[] | undefined = [],
  search: string | undefined
): Grammar => {
  /**
   * See:
   * - https://github.com/grafana/grafana/blob/96f1582c36f94cf4ac7621b7af86bc9e2ad626fb/public/app/features/logs/components/LogRowMessage.tsx#L67
   * - https://github.com/grafana/grafana/blob/96f1582c36f94cf4ac7621b7af86bc9e2ad626fb/packages/grafana-data/src/text/text.ts#L12
   */
  const expressions = highlightWords.map((word) => {
    const { cleaned, flags } = parseFlags(cleanNeedle(word));
    return new RegExp(`(?:${cleaned})`, flags);
  });
  if (search) {
    expressions.push(new RegExp(escapeRegex(search), 'gi'));
  }
  if (!expressions.length) {
    return {};
  }
  return {
    'log-search-match': expressions,
  };
};

const cleanNeedle = (needle: string): string => {
  return needle.replace(/[[{(][\w,.\/:;<=>?:*+]+$/, '');
};
