/* */ 
(function(process) {
  'use strict';
  var lang_1 = require('../../facade/lang');
  var promise_1 = require('../../facade/promise');
  var async_1 = require('../../facade/async');
  var collection_1 = require('../../facade/collection');
  var core_1 = require('../../../core');
  exports.NG_VALIDATORS = lang_1.CONST_EXPR(new core_1.OpaqueToken("NgValidators"));
  exports.NG_ASYNC_VALIDATORS = lang_1.CONST_EXPR(new core_1.OpaqueToken("NgAsyncValidators"));
  var Validators = (function() {
    function Validators() {}
    Validators.required = function(control) {
      return lang_1.isBlank(control.value) || control.value == "" ? {"required": true} : null;
    };
    Validators.minLength = function(minLength) {
      return function(control) {
        if (lang_1.isPresent(Validators.required(control)))
          return null;
        var v = control.value;
        return v.length < minLength ? {"minlength": {
            "requiredLength": minLength,
            "actualLength": v.length
          }} : null;
      };
    };
    Validators.maxLength = function(maxLength) {
      return function(control) {
        if (lang_1.isPresent(Validators.required(control)))
          return null;
        var v = control.value;
        return v.length > maxLength ? {"maxlength": {
            "requiredLength": maxLength,
            "actualLength": v.length
          }} : null;
      };
    };
    Validators.nullValidator = function(c) {
      return null;
    };
    Validators.compose = function(validators) {
      if (lang_1.isBlank(validators))
        return null;
      var presentValidators = validators.filter(lang_1.isPresent);
      if (presentValidators.length == 0)
        return null;
      return function(control) {
        return _mergeErrors(_executeValidators(control, presentValidators));
      };
    };
    Validators.composeAsync = function(validators) {
      if (lang_1.isBlank(validators))
        return null;
      var presentValidators = validators.filter(lang_1.isPresent);
      if (presentValidators.length == 0)
        return null;
      return function(control) {
        var promises = _executeValidators(control, presentValidators).map(_convertToPromise);
        return promise_1.PromiseWrapper.all(promises).then(_mergeErrors);
      };
    };
    return Validators;
  })();
  exports.Validators = Validators;
  function _convertToPromise(obj) {
    return promise_1.PromiseWrapper.isPromise(obj) ? obj : async_1.ObservableWrapper.toPromise(obj);
  }
  function _executeValidators(control, validators) {
    return validators.map(function(v) {
      return v(control);
    });
  }
  function _mergeErrors(arrayOfErrors) {
    var res = arrayOfErrors.reduce(function(res, errors) {
      return lang_1.isPresent(errors) ? collection_1.StringMapWrapper.merge(res, errors) : res;
    }, {});
    return collection_1.StringMapWrapper.isEmpty(res) ? null : res;
  }
})(require('process'));
