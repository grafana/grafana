/* */ 
'use strict';
var $ = require('./$'),
    descriptor = require('./$.property-desc'),
    setToStringTag = require('./$.set-to-string-tag'),
    IteratorPrototype = {};
require('./$.hide')(IteratorPrototype, require('./$.wks')('iterator'), function() {
  return this;
});
module.exports = function(Constructor, NAME, next) {
  Constructor.prototype = $.create(IteratorPrototype, {next: descriptor(1, next)});
  setToStringTag(Constructor, NAME + ' Iterator');
};
