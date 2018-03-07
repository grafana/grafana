'use strict';

var _ = require('lodash'),
    docdown = require('docdown'),
    fs = require('fs-extra'),
    path = require('path');

var util = require('../common/util');

var basePath = path.join(__dirname, '..', '..'),
    docPath = path.join(basePath, 'doc'),
    readmePath = path.join(docPath, 'README.md');

var pkg = require('../../package.json'),
    version = pkg.version;

var config = {
  'base': {
    'path': path.join(basePath, 'lodash.js'),
    'title': '<a href="https://lodash.com/">lodash</a> <span>v' + version + '</span>',
    'toc': 'categories',
    'url': 'https://github.com/lodash/lodash/blob/' + version + '/lodash.js'
  },
  'github': {
    'style': 'github',
    'sublinks': [npmLink('&#x24C3;', 'See the npm package')]
  },
  'site': {
    'entryLink': '<a href="${entryHref}" class="fa fa-link"></a>',
    'sourceLink': '[source](${sourceHref})',
    'tocHref': '',
    'tocLink': '',
    'sublinks': [npmLink('npm package')]
  }
};

/**
 * Composes a npm link from `text` and optional `title`.
 *
 * @private
 * @param {string} text The link text.
 * @param {string} [title] The link title.
 * @returns {string} Returns the composed npm link.
 */
function npmLink(text, title) {
  return (
    '<% if (name == "templateSettings" || !/^(?:methods|properties|seq)$/i.test(category)) {' +
      'print(' +
        '"[' + text + '](https://www.npmjs.com/package/lodash." + name.toLowerCase() + ' +
        '"' + (title == null ? '' : ' \\"' + title + '\\"') + ')"' +
      ');' +
    '} %>'
  );
}

/**
 * Post-process `markdown` to make adjustments.
 *
 * @private
 * @param {string} markdown The markdown to process.
 * @returns {string} Returns the processed markdown.
 */
function postprocess(markdown) {
  // Wrap symbol property identifiers in brackets.
  return markdown.replace(/\.(Symbol\.(?:[a-z]+[A-Z]?)+)/g, '[$1]');
}

/*----------------------------------------------------------------------------*/

/**
 * Creates the documentation markdown formatted for 'github' or 'site'.
 *
 * @private
 * @param {string} type The format type.
 */
function build(type) {
  var options = _.defaults({}, config.base, config[type]),
      markdown = docdown(options);

  fs.writeFile(readmePath, postprocess(markdown), util.pitch);
}

build(_.last(process.argv));
