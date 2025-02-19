// import { Grammar } from 'prismjs';

import { Grammar } from 'prismjs';

import { FUNCTIONS, KEYWORDS, QUERY_COMMANDS } from '../../language/cloudwatch-logs/syntax';
import * as sql from '../../language/cloudwatch-logs-sql/language';
import * as ppl from '../../language/cloudwatch-ppl/language';

export const baseTokenizer = (languageSpecificFeatures: Grammar): Grammar => ({
  comment: {
    pattern: /^#.*/,
    greedy: true,
  },
  backticks: {
    pattern: /`.*?`/,
    alias: 'string',
    greedy: true,
  },
  quote: {
    pattern: /[\"'].*?[\"']/,
    alias: 'string',
    greedy: true,
  },
  regex: {
    pattern: /\/.*?\/(?=\||\s*$|,)/,
    greedy: true,
  },
  ...languageSpecificFeatures,

  'field-name': {
    pattern: /(@?[_a-zA-Z]+[_.0-9a-zA-Z]*)|(`((\\`)|([^`]))*?`)/,
    greedy: true,
  },
  number: /\b-?\d+((\.\d*)?([eE][+-]?\d+)?)?\b/,
  'command-separator': {
    pattern: /\|/,
    alias: 'punctuation',
  },
  'comparison-operator': {
    pattern: /([<>]=?)|(!?=)/,
  },
  punctuation: /[{}()`,.]/,
  whitespace: /\s+/,
});

export const cwliTokenizer: Grammar = {
  ...baseTokenizer({
    'query-command': {
      pattern: new RegExp(`\\b(?:${QUERY_COMMANDS.map((command) => command.label).join('|')})\\b`, 'i'),
      alias: 'function',
    },
    function: {
      pattern: new RegExp(`\\b(?:${FUNCTIONS.map((f) => f.label).join('|')})\\b`, 'i'),
    },
    keyword: {
      pattern: new RegExp(`(\\s+)(${KEYWORDS.join('|')})(?=\\s+)`, 'i'),
      lookbehind: true,
    },
  }),
};

export const pplTokenizer: Grammar = {
  ...baseTokenizer({
    'query-command': {
      pattern: new RegExp(`\\b(?:${ppl.PPL_COMMANDS.join('|')})\\b`, 'i'),
      alias: 'function',
    },
    function: {
      pattern: new RegExp(`\\b(?:${ppl.ALL_FUNCTIONS.join('|')})\\b`, 'i'),
    },
    keyword: {
      pattern: new RegExp(`(\\s+)(${ppl.ALL_KEYWORDS.join('|')})(?=\\s+)`, 'i'),
      lookbehind: true,
    },
    operator: {
      pattern: new RegExp(`\\b(?:${ppl.PPL_OPERATORS.map((operator) => `\\${operator}`).join('|')})\\b`, 'i'),
    },
  }),
};

export const sqlTokenizer = {
  ...baseTokenizer({
    function: {
      pattern: new RegExp(`\\b(?:${sql.ALL_FUNCTIONS.join('|')})\\b(?!\\.)`, 'i'),
    },
    keyword: {
      pattern: new RegExp(`\\b(?:${sql.ALL_KEYWORDS.join('|')})\\b(?=\\s)`, 'i'),
      lookbehind: true,
    },
    operator: {
      pattern: new RegExp(`\\b(?:${sql.ALL_OPERATORS.map((operator) => `\\${operator}`).join('|')})\\b`, 'i'),
    },
  }),
};
