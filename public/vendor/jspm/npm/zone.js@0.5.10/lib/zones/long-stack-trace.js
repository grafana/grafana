/*
 * Wrapped stacktrace
 *
 * We need this because in some implementations, constructing a trace is slow
 * and so we want to defer accessing the trace for as long as possible
 */

'use strict';

function _Stacktrace(e) {
  this._e = e;
};

_Stacktrace.prototype.get = function () {
  if (global.zone.stackFramesFilter && this._e.stack) {
    return this._e.stack
      .split('\n')
      .filter(global.zone.stackFramesFilter)
      .join('\n');
  }

  return this._e.stack;
}

function _getStacktraceWithUncaughtError () {
  return new _Stacktrace(new Error());
}

function _getStacktraceWithCaughtError () {
  try {
    throw new Error();
  } catch (e) {
    return new _Stacktrace(e);
  }
}

// Some implementations of exception handling don't create a stack trace if the exception
// isn't thrown, however it's faster not to actually throw the exception.
var stack = _getStacktraceWithUncaughtError();

var _getStacktrace = stack && stack._e.stack
  ? _getStacktraceWithUncaughtError
  : _getStacktraceWithCaughtError;

module.exports = {
  getLongStacktrace: function (exception) {
    var traces = [];
    var currentZone = this;
    if (exception) {
      if (currentZone.stackFramesFilter && exception.stack) {
        traces.push(exception.stack.split('\n')
              .filter(currentZone.stackFramesFilter)
              .join('\n'));
      } else {
        traces.push(exception.stack);
      }
    }
    var now = Date.now();

    while (currentZone && currentZone.constructedAtException) {
      traces.push(
          '--- ' + (Date(currentZone.constructedAtTime)).toString() +
          ' - ' + (now - currentZone.constructedAtTime) + 'ms ago',
          currentZone.constructedAtException.get());
      currentZone = currentZone.parent;
    }

    return traces.join('\n');
  },

  stackFramesFilter: function (line) {
    return !/zone(-microtask)?(\.min)?\.js/.test(line);
  },

  onError: function (exception) {
    var reporter = this.reporter || console.log.bind(console);
    reporter(exception.toString());
    reporter(this.getLongStacktrace(exception));
  },

  '$fork': function (parentFork) {
    return function() {
      var newZone = parentFork.apply(this, arguments);
      newZone.constructedAtException = _getStacktrace();
      newZone.constructedAtTime = Date.now();
      return newZone;
    }
  }
};

