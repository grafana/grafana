'use strict';

var _ = require('lodash'),
    fs = require('fs'),
    marky = require('marky-markdown'),
    path = require('path'),
    util = require('../common/util');

var basePath = path.join(__dirname, '..', '..'),
    docPath = path.join(basePath, 'doc'),
    readmePath = path.join(docPath, 'README.md');

function build(type) {
  var markdown = fs
    // Load markdown.
    .readFileSync(readmePath, 'utf8')
    // Uncomment docdown HTML hints.
    .replace(/(<)!--\s*|\s*--(>)/g, '$1$2');

  var $ = marky(markdown, { 'sanitize': false }),
      $header = $('h1').first().remove(),
      version = _.trim($header.find('span').first().text()).slice(1);

  // Remove docdown horizontal rules.
  $('hr').remove();

  // Remove marky-markdown additions.
  $('[id^="user-content-"]')
    .attr('class', null)
    .attr('id', null);

  $(':header:not(h3) > a').each(function() {
    var $a = $(this);
    $a.replaceWith($a.html());
  });

  // Fix marky-markdown wrapping around headers.
  $('p:empty + h3').prev().remove();

  $('h3 ~ p:empty').each(function() {
    var $p = $(this),
        node = this.previousSibling;

    while ((node = node.previousSibling) && node.name != 'h3' && node.name != 'p') {
      $p.prepend(node.nextSibling);
    }
  });

  $('h3 code em').parent().each(function() {
    var $code = $(this);
    $code.html($code.html().replace(/<\/?em>/g, '_'));
  });

  var html = [
    // Append YAML front matter.
    '---',
    'id: docs',
    'layout: docs',
    'title: Lodash Documentation',
    'version: ' + (version || null),
    '---',
    '',
    // Wrap in raw tags to avoid Liquid template tag processing.
    '{% raw %}',
    _.trim($.html()),
    '{% endraw %}',
    ''
  ].join('\n');

  fs.writeFile(path.join(docPath, version + '.html'), html, util.pitch);
}

build();
