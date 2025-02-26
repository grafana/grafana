import { Grammar } from 'prismjs';

import { LogListModel } from './processing';

// The Logs grammar is used for highlight in the logs panel
export const logsGrammar: Grammar = {
  'log-token-timestamp': /\b\d{4}-\d{2}-\d{2}[T|\s]{1}\d{1,2}:\d{2}:\d{2}(?:[\.]{0,1}\d{0,9})?(?:Z|\+\d{2}:\d{2}|\b)\b/,
  'log-token-json-key': /"(\b|\B)[\w-]+"(?=\s*:)/gi,
  'log-token-key': /(\b|\B)[\w_]+(?=\s*=)/gi,
  'log-token-size': /"\d+\.{0,1}\d*\s*[kKmMGgtTPp]*[bB]{1}"/g,
  'log-token-string': /"(?!:)(\\?[^'"])*?"(?!:)/g,
  'log-token-number': /\b-?(0x[\dA-Fa-f]+|\d*\.?\d+([Ee]-?\d+)?)\b/g,
};

export const generateLogGrammar = (log: LogListModel) => {
  const labels = Object.keys(log.labels).concat(log.fields.map((field) => field.keys[0]));
  const logGrammar: Grammar = {
    'log-token-label': new RegExp(`\\b(${labels.join('|')})(?:[=:]{1})\\b`, 'g'),
  };
  return {
    ...logGrammar,
    ...logsGrammar,
  };
};
