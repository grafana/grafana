/* */ 
(function(process) {
  var ctx = require('./$.ctx'),
      invoke = require('./$.invoke'),
      html = require('./$.html'),
      cel = require('./$.dom-create'),
      global = require('./$.global'),
      process = global.process,
      setTask = global.setImmediate,
      clearTask = global.clearImmediate,
      MessageChannel = global.MessageChannel,
      counter = 0,
      queue = {},
      ONREADYSTATECHANGE = 'onreadystatechange',
      defer,
      channel,
      port;
  var run = function() {
    var id = +this;
    if (queue.hasOwnProperty(id)) {
      var fn = queue[id];
      delete queue[id];
      fn();
    }
  };
  var listner = function(event) {
    run.call(event.data);
  };
  if (!setTask || !clearTask) {
    setTask = function setImmediate(fn) {
      var args = [],
          i = 1;
      while (arguments.length > i)
        args.push(arguments[i++]);
      queue[++counter] = function() {
        invoke(typeof fn == 'function' ? fn : Function(fn), args);
      };
      defer(counter);
      return counter;
    };
    clearTask = function clearImmediate(id) {
      delete queue[id];
    };
    if (require('./$.cof')(process) == 'process') {
      defer = function(id) {
        process.nextTick(ctx(run, id, 1));
      };
    } else if (MessageChannel) {
      channel = new MessageChannel;
      port = channel.port2;
      channel.port1.onmessage = listner;
      defer = ctx(port.postMessage, port, 1);
    } else if (global.addEventListener && typeof postMessage == 'function' && !global.importScripts) {
      defer = function(id) {
        global.postMessage(id + '', '*');
      };
      global.addEventListener('message', listner, false);
    } else if (ONREADYSTATECHANGE in cel('script')) {
      defer = function(id) {
        html.appendChild(cel('script'))[ONREADYSTATECHANGE] = function() {
          html.removeChild(this);
          run.call(id);
        };
      };
    } else {
      defer = function(id) {
        setTimeout(ctx(run, id, 1), 0);
      };
    }
  }
  module.exports = {
    set: setTask,
    clear: clearTask
  };
})(require('process'));
