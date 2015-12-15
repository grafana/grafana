/* */ 
(function(process) {
  var root_1 = require('./root');
  var ImmediateDefinition = (function() {
    function ImmediateDefinition(root) {
      this.root = root;
      if (root.setImmediate) {
        this.setImmediate = root.setImmediate;
        this.clearImmediate = root.clearImmediate;
      } else {
        this.nextHandle = 1;
        this.tasksByHandle = {};
        this.currentlyRunningATask = false;
        if (this.canUseProcessNextTick()) {
          this.setImmediate = this.createProcessNextTickSetImmediate();
        } else if (this.canUsePostMessage()) {
          this.setImmediate = this.createPostMessageSetImmediate();
        } else if (this.canUseMessageChannel()) {
          this.setImmediate = this.createMessageChannelSetImmediate();
        } else if (this.canUseReadyStateChange()) {
          this.setImmediate = this.createReadyStateChangeSetImmediate();
        } else {
          this.setImmediate = this.createSetTimeoutSetImmediate();
        }
        var ci = function clearImmediate(handle) {
          delete clearImmediate.instance.tasksByHandle[handle];
        };
        ci.instance = this;
        this.clearImmediate = ci;
      }
    }
    ImmediateDefinition.prototype.identify = function(o) {
      return this.root.Object.prototype.toString.call(o);
    };
    ImmediateDefinition.prototype.canUseProcessNextTick = function() {
      return this.identify(this.root.process) === '[object process]';
    };
    ImmediateDefinition.prototype.canUseMessageChannel = function() {
      return Boolean(this.root.MessageChannel);
    };
    ImmediateDefinition.prototype.canUseReadyStateChange = function() {
      var document = this.root.document;
      return Boolean(document && 'onreadystatechange' in document.createElement('script'));
    };
    ImmediateDefinition.prototype.canUsePostMessage = function() {
      var root = this.root;
      if (root.postMessage && !root.importScripts) {
        var postMessageIsAsynchronous = true;
        var oldOnMessage = root.onmessage;
        root.onmessage = function() {
          postMessageIsAsynchronous = false;
        };
        root.postMessage('', '*');
        root.onmessage = oldOnMessage;
        return postMessageIsAsynchronous;
      }
      return false;
    };
    ImmediateDefinition.prototype.partiallyApplied = function(handler) {
      var args = [];
      for (var _i = 1; _i < arguments.length; _i++) {
        args[_i - 1] = arguments[_i];
      }
      var fn = function result() {
        var _a = result,
            handler = _a.handler,
            args = _a.args;
        if (typeof handler === 'function') {
          handler.apply(undefined, args);
        } else {
          (new Function('' + handler))();
        }
      };
      fn.handler = handler;
      fn.args = args;
      return fn;
    };
    ImmediateDefinition.prototype.addFromSetImmediateArguments = function(args) {
      this.tasksByHandle[this.nextHandle] = this.partiallyApplied.apply(undefined, args);
      return this.nextHandle++;
    };
    ImmediateDefinition.prototype.createProcessNextTickSetImmediate = function() {
      var fn = function setImmediate() {
        var instance = setImmediate.instance;
        var handle = instance.addFromSetImmediateArguments(arguments);
        instance.root.process.nextTick(instance.partiallyApplied(instance.runIfPresent, handle));
        return handle;
      };
      fn.instance = this;
      return fn;
    };
    ImmediateDefinition.prototype.createPostMessageSetImmediate = function() {
      var root = this.root;
      var messagePrefix = 'setImmediate$' + root.Math.random() + '$';
      var onGlobalMessage = function globalMessageHandler(event) {
        var instance = globalMessageHandler.instance;
        if (event.source === root && typeof event.data === 'string' && event.data.indexOf(messagePrefix) === 0) {
          instance.runIfPresent(+event.data.slice(messagePrefix.length));
        }
      };
      onGlobalMessage.instance = this;
      root.addEventListener('message', onGlobalMessage, false);
      var fn = function setImmediate() {
        var _a = setImmediate,
            messagePrefix = _a.messagePrefix,
            instance = _a.instance;
        var handle = instance.addFromSetImmediateArguments(arguments);
        instance.root.postMessage(messagePrefix + handle, '*');
        return handle;
      };
      fn.instance = this;
      fn.messagePrefix = messagePrefix;
      return fn;
    };
    ImmediateDefinition.prototype.runIfPresent = function(handle) {
      if (this.currentlyRunningATask) {
        this.root.setTimeout(this.partiallyApplied(this.runIfPresent, handle), 0);
      } else {
        var task = this.tasksByHandle[handle];
        if (task) {
          this.currentlyRunningATask = true;
          try {
            task();
          } finally {
            this.clearImmediate(handle);
            this.currentlyRunningATask = false;
          }
        }
      }
    };
    ImmediateDefinition.prototype.createMessageChannelSetImmediate = function() {
      var _this = this;
      var channel = new this.root.MessageChannel();
      channel.port1.onmessage = function(event) {
        var handle = event.data;
        _this.runIfPresent(handle);
      };
      var fn = function setImmediate() {
        var _a = setImmediate,
            channel = _a.channel,
            instance = _a.instance;
        var handle = instance.addFromSetImmediateArguments(arguments);
        channel.port2.postMessage(handle);
        return handle;
      };
      fn.channel = channel;
      fn.instance = this;
      return fn;
    };
    ImmediateDefinition.prototype.createReadyStateChangeSetImmediate = function() {
      var fn = function setImmediate() {
        var instance = setImmediate.instance;
        var root = instance.root;
        var doc = root.document;
        var html = doc.documentElement;
        var handle = instance.addFromSetImmediateArguments(arguments);
        var script = doc.createElement('script');
        script.onreadystatechange = function() {
          instance.runIfPresent(handle);
          script.onreadystatechange = null;
          html.removeChild(script);
          script = null;
        };
        html.appendChild(script);
        return handle;
      };
      fn.instance = this;
      return fn;
    };
    ImmediateDefinition.prototype.createSetTimeoutSetImmediate = function() {
      var fn = function setImmediate() {
        var instance = setImmediate.instance;
        var handle = instance.addFromSetImmediateArguments(arguments);
        instance.root.setTimeout(instance.partiallyApplied(instance.runIfPresent, handle), 0);
        return handle;
      };
      fn.instance = this;
      return fn;
    };
    return ImmediateDefinition;
  })();
  exports.ImmediateDefinition = ImmediateDefinition;
  exports.Immediate = new ImmediateDefinition(root_1.root);
})(require('process'));
