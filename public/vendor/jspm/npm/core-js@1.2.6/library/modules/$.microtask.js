/* */ 
(function(process) {
  var global = require('./$.global'),
      macrotask = require('./$.task').set,
      Observer = global.MutationObserver || global.WebKitMutationObserver,
      process = global.process,
      Promise = global.Promise,
      isNode = require('./$.cof')(process) == 'process',
      head,
      last,
      notify;
  var flush = function() {
    var parent,
        domain,
        fn;
    if (isNode && (parent = process.domain)) {
      process.domain = null;
      parent.exit();
    }
    while (head) {
      domain = head.domain;
      fn = head.fn;
      if (domain)
        domain.enter();
      fn();
      if (domain)
        domain.exit();
      head = head.next;
    }
    last = undefined;
    if (parent)
      parent.enter();
  };
  if (isNode) {
    notify = function() {
      process.nextTick(flush);
    };
  } else if (Observer) {
    var toggle = 1,
        node = document.createTextNode('');
    new Observer(flush).observe(node, {characterData: true});
    notify = function() {
      node.data = toggle = -toggle;
    };
  } else if (Promise && Promise.resolve) {
    notify = function() {
      Promise.resolve().then(flush);
    };
  } else {
    notify = function() {
      macrotask.call(global, flush);
    };
  }
  module.exports = function asap(fn) {
    var task = {
      fn: fn,
      next: undefined,
      domain: isNode && process.domain
    };
    if (last)
      last.next = task;
    if (!head) {
      head = task;
      notify();
    }
    last = task;
  };
})(require('process'));
