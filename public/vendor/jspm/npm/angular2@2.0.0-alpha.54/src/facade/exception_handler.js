/* */ 
'use strict';
var lang_1 = require('./lang');
var exceptions_1 = require('./exceptions');
var collection_1 = require('./collection');
var _ArrayLogger = (function() {
  function _ArrayLogger() {
    this.res = [];
  }
  _ArrayLogger.prototype.log = function(s) {
    this.res.push(s);
  };
  _ArrayLogger.prototype.logError = function(s) {
    this.res.push(s);
  };
  _ArrayLogger.prototype.logGroup = function(s) {
    this.res.push(s);
  };
  _ArrayLogger.prototype.logGroupEnd = function() {};
  ;
  return _ArrayLogger;
})();
var ExceptionHandler = (function() {
  function ExceptionHandler(_logger, _rethrowException) {
    if (_rethrowException === void 0) {
      _rethrowException = true;
    }
    this._logger = _logger;
    this._rethrowException = _rethrowException;
  }
  ExceptionHandler.exceptionToString = function(exception, stackTrace, reason) {
    if (stackTrace === void 0) {
      stackTrace = null;
    }
    if (reason === void 0) {
      reason = null;
    }
    var l = new _ArrayLogger();
    var e = new ExceptionHandler(l, false);
    e.call(exception, stackTrace, reason);
    return l.res.join("\n");
  };
  ExceptionHandler.prototype.call = function(exception, stackTrace, reason) {
    if (stackTrace === void 0) {
      stackTrace = null;
    }
    if (reason === void 0) {
      reason = null;
    }
    var originalException = this._findOriginalException(exception);
    var originalStack = this._findOriginalStack(exception);
    var context = this._findContext(exception);
    this._logger.logGroup("EXCEPTION: " + this._extractMessage(exception));
    if (lang_1.isPresent(stackTrace) && lang_1.isBlank(originalStack)) {
      this._logger.logError("STACKTRACE:");
      this._logger.logError(this._longStackTrace(stackTrace));
    }
    if (lang_1.isPresent(reason)) {
      this._logger.logError("REASON: " + reason);
    }
    if (lang_1.isPresent(originalException)) {
      this._logger.logError("ORIGINAL EXCEPTION: " + this._extractMessage(originalException));
    }
    if (lang_1.isPresent(originalStack)) {
      this._logger.logError("ORIGINAL STACKTRACE:");
      this._logger.logError(this._longStackTrace(originalStack));
    }
    if (lang_1.isPresent(context)) {
      this._logger.logError("ERROR CONTEXT:");
      this._logger.logError(context);
    }
    this._logger.logGroupEnd();
    if (this._rethrowException)
      throw exception;
  };
  ExceptionHandler.prototype._extractMessage = function(exception) {
    return exception instanceof exceptions_1.WrappedException ? exception.wrapperMessage : exception.toString();
  };
  ExceptionHandler.prototype._longStackTrace = function(stackTrace) {
    return collection_1.isListLikeIterable(stackTrace) ? stackTrace.join("\n\n-----async gap-----\n") : stackTrace.toString();
  };
  ExceptionHandler.prototype._findContext = function(exception) {
    try {
      if (!(exception instanceof exceptions_1.WrappedException))
        return null;
      return lang_1.isPresent(exception.context) ? exception.context : this._findContext(exception.originalException);
    } catch (e) {
      return null;
    }
  };
  ExceptionHandler.prototype._findOriginalException = function(exception) {
    if (!(exception instanceof exceptions_1.WrappedException))
      return null;
    var e = exception.originalException;
    while (e instanceof exceptions_1.WrappedException && lang_1.isPresent(e.originalException)) {
      e = e.originalException;
    }
    return e;
  };
  ExceptionHandler.prototype._findOriginalStack = function(exception) {
    if (!(exception instanceof exceptions_1.WrappedException))
      return null;
    var e = exception;
    var stack = exception.originalStack;
    while (e instanceof exceptions_1.WrappedException && lang_1.isPresent(e.originalException)) {
      e = e.originalException;
      if (e instanceof exceptions_1.WrappedException && lang_1.isPresent(e.originalException)) {
        stack = e.originalStack;
      }
    }
    return stack;
  };
  return ExceptionHandler;
})();
exports.ExceptionHandler = ExceptionHandler;
