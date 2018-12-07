/* tslint:disable max-line-length */

const tokenizer = {
  comment: {
    pattern: /(^|[^\n])#.*/,
    lookbehind: true,
  },
  'context-labels': {
    pattern: /(^|\s)\{[^}]*(?=})/,
    lookbehind: true,
    inside: {
      'label-key': {
        pattern: /[a-z_]\w*(?=\s*(=|!=|=~|!~))/,
        alias: 'attr-name',
      },
      'label-value': {
        pattern: /"(?:\\.|[^\\"])*"/,
        greedy: true,
        alias: 'attr-value',
      },
      punctuation: /[{]/,
    },
  },
  // number: /\b-?\d+((\.\d*)?([eE][+-]?\d+)?)?\b/,
  operator: new RegExp(`/&&?|\\|?\\||!=?|<(?:=>?|<|>)?|>[>=]?`, 'i'),
  punctuation: /[{}`,.]/,
};

export default tokenizer;
