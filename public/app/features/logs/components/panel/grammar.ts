import { Grammar } from 'prismjs';

import { LogListModel } from './processing';

// The Logs grammar is used for highlight in the logs panel
export const logsGrammar: Grammar = {
  timestamp: /\b\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,9})?([+-]\d{2}:?\d{2}|\d{4})?\b/,
  timestamp_iso: /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?Z\b/,
  size: {
    pattern: /\b\d+(\.\d+)?\s*[kKmMGgPpbB]?\s*[bB]?\b/,
    alias: 'log-token-number',
    greedy: true,
  },
  quote: {
    pattern: /(?::\s*|=)"(?:\\.|[^\\"])*"/,
    alias: 'log-token-string',
    greedy: true,
  },
  backticks: {
    pattern: /`(?:\\.|[^\\`])*`/,
    alias: 'log-token-string',
    greedy: true,
  },
  number: {
    pattern: /\b\d+(?:\.\d+)?\b/,
    alias: 'log-token-number',
  },
};

export const generateLogGrammar = (log: LogListModel) => {
  const labels = Object.keys(log.labels).concat(log.fields.map((field) => field.keys[0]));
  const logGrammar: Grammar = {
    log_field: {
      pattern: new RegExp(`\\b(${labels.join('|')})(?:[=:]{1})\\b`, 'g'),
      alias: 'log-token-label',
    },
  };
  return {
    ...logGrammar,
    ...logsGrammar,
  };
};
