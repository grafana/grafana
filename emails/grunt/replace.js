module.exports = function () {
  'use strict';

  return {
    txt,
    comments,
  };
};

const txt = {
  overwrite: true,
  src: ['dist/*.txt'],
  replacements: [
    {
      from: '[[',
      to: '{{',
    },
    {
      from: ']]',
      to: '}}',
    },
  ],
};

/**
 * Replace all instances of HTML comments with {{ __dangerouslyInjectHTML "<!-- my comment -->" }}.
 *
 * MJML will output <!--[if !mso]><!--> comments which are specific to MS Outlook.
 *
 * Go's template/html package will strip all HTML comments and we need them to be preserved
 * to work with MS Outlook on the Desktop.
 */
const HTML_SAFE_FUNC = '__dangerouslyInjectHTML';
const commentBlock = /(<!--[\s\S]*?-->)/g;

const comments = {
  overwrite: true,
  src: ['dist/*.html'],
  replacements: [
    {
      from: commentBlock,
      to: `{{ ${HTML_SAFE_FUNC} \`$1\` }}`,
    },
  ],
};
