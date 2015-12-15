/* */ 
(function(process) {
  'use strict';
  if (process.env.OBJECT_IMPL)
    global.TYPED_ARRAY_SUPPORT = false;
  var Buffer = require('../../index').Buffer;
  var common = {};
  var assert = require('assert');
  assert.equal(Buffer('hérité').toString('ascii'), 'hC)ritC)');
  var input = 'C’est, graphiquement, la réunion d’un accent aigu ' + 'et d’un accent grave.';
  var expected = 'Cb\u0000\u0019est, graphiquement, la rC)union ' + 'db\u0000\u0019un accent aigu et db\u0000\u0019un ' + 'accent grave.';
  var buf = Buffer(input);
  for (var i = 0; i < expected.length; ++i) {
    assert.equal(buf.slice(i).toString('ascii'), expected.slice(i));
    if (input.charCodeAt(i) > 65535)
      ++i;
    if (input.charCodeAt(i) > 127)
      ++i;
  }
})(require('process'));
