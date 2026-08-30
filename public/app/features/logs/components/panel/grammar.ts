import { type Grammar } from 'prismjs';

import { escapeRegex, type LogRowModel, parseFlags } from '@grafana/data';

import { type LogListModel } from './processing';

// The Logs grammar is used for highlight in the logs panel
const logsGrammar: Grammar = {
  'log-token-key': /(\b|\B)[\w_]+(?=\s*=)/gi,
  'log-token-string': /"(?!:)([^'"])*?"(?!:)/g,
};

const tokensGrammar: Grammar = {
  'log-token-uuid': /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/g,
  'log-token-size': /(?:\b|")\d+\.{0,1}\d*\s*[kKmMGgtTPp]*[bB]{1}(?:"|\b)/g,
  'log-token-duration': /\b(?:\d+(?:\.\d+)?(?:ns|µs|ms|s|m|h|d|w|y))+\b/g,
  'log-token-method': /\b(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|TRACE|CONNECT)\b/g,
};

const jsonGrammar: Grammar = {
  'log-token-json-key': {
    pattern: /(^|[^\\])"(?:\\.|[^\\"\r\n])*"(?=\s*:)/,
    lookbehind: true,
  },
  'log-token-string': {
    pattern: /(^|[^\\])"(?:\\.|[^\\"\r\n])*"(?!\s*:)/,
    lookbehind: true,
    inside: {
      ...tokensGrammar,
    },
  },
  'log-token-size': /-?\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/i,
};

export const generateLogGrammar = (log: LogListModel) => {
  const labels = Object.keys(log.labels)
    .concat(log.fields.map((field) => field.keys[0]))
    .map((label) => escapeRegex(label));
  const labelGrammar: Grammar = {
    'log-token-label': new RegExp(`\\b(${labels.join('|')})(?:[=:]{1})\\b`, 'g'),
  };
  if (log.isJSON) {
    return {
      ...labelGrammar,
      ...jsonGrammar,
    };
  }
  return {
    ...labelGrammar,
    ...tokensGrammar,
    ...logsGrammar,
  };
};

export const generateTextMatchGrammar = (highlightWords: string[] | undefined = [], search?: string): Grammar => {
  /**
   * See:
   * - https://github.com/grafana/grafana/blob/96f1582c36f94cf4ac7621b7af86bc9e2ad626fb/public/app/features/logs/components/LogRowMessage.tsx#L67
   * - https://github.com/grafana/grafana/blob/96f1582c36f94cf4ac7621b7af86bc9e2ad626fb/packages/grafana-data/src/text/text.ts#L12
   */
  const expressions = highlightWords
    .map((word) => {
      const { cleaned, flags } = parseFlags(cleanNeedle(word));
      try {
        return new RegExp(`(?:${cleaned})`, flags);
      } catch (e) {
        console.error(`generateTextMatchGrammar: cannot generate regular expression from /${cleaned}/${flags}`, e);
      }
      return undefined;
    })
    .filter((expression) => expression !== undefined);

  if (search) {
    try {
      expressions.push(new RegExp(escapeRegex(search), 'gi'));
    } catch (e) {
      console.error(`generateTextMatchGrammar: cannot generate regular expression from /${search}/gi`, e);
    }
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

/**
 * Prism tokenization + React token trees become expensive past this many characters
 * in a single line.
 */
const MAX_HIGHLIGHT_LINE_LENGTH = 20_000;

/**
 * generateLogGrammar compiles every label key into one alternation regex.
 */
const MAX_HIGHLIGHT_LABEL_COUNT = 100;

/**
 * Combined budget: line length × label count. Independent caps still allow a 20k-char
 * line with 100 labels (~2M regex operations); this catches that worst case.
 */
const MAX_HIGHLIGHT_COST = 1_000_000;

/**
 * Evaluate logs length and fields count to decide if the logs can be highlighted or
 * else disable the feature to protect the user against freezes.
 */
export function logsSupportHighlighting(logs: LogRowModel[]): boolean {
  for (const log of logs) {
    if (!logSupportsHighlighting(log)) {
      return false;
    }
  }
  return true;
}

function logSupportsHighlighting(log: LogRowModel): boolean {
  const lineLength = Math.max(log.entry?.length ?? 0, log.raw?.length ?? 0);
  if (lineLength > MAX_HIGHLIGHT_LINE_LENGTH) {
    return false;
  }

  const labelCount = Object.keys(log.labels).length;
  if (labelCount > MAX_HIGHLIGHT_LABEL_COUNT) {
    return false;
  }

  // Empty labels still cost ~one regex pass over the line; use 1 so cost tracks length.
  if (lineLength * Math.max(labelCount, 1) > MAX_HIGHLIGHT_COST) {
    return false;
  }

  return true;
}
