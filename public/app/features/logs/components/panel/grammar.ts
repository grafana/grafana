import { Grammar } from 'prismjs';

import { LogListModel } from './processing';

// The Logs grammar is used for highlight in the logs panel
export const logsGrammar: Grammar = {
  'log-token-uuid': /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/g,
  'log-token-json-key': /"(\b|\B)[\w-]+"(?=\s*:)/gi,
  'log-token-key': /(\b|\B)[\w_]+(?=\s*=)/gi,
  'log-token-size': /(?:\b|")\d+\.{0,1}\d*\s*[kKmMGgtTPp]*[bB]{1}(?:"|\b)/g,
  'log-token-duration': /(?:\b)\d+(\.\d+)?(ns|µs|ms|s|m|h|d)(?:\b)/g,
  'log-token-method': /\b(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|TRACE|CONNECT)\b/g,
  'log-token-string': /"(?!:)([^'"])*?"(?!:)/g,
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
