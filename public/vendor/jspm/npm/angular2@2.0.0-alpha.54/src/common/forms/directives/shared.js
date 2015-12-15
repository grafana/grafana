/* */ 
'use strict';
var collection_1 = require('../../../facade/collection');
var lang_1 = require('../../../facade/lang');
var exceptions_1 = require('../../../facade/exceptions');
var validators_1 = require('../validators');
var default_value_accessor_1 = require('./default_value_accessor');
var number_value_accessor_1 = require('./number_value_accessor');
var checkbox_value_accessor_1 = require('./checkbox_value_accessor');
var select_control_value_accessor_1 = require('./select_control_value_accessor');
var normalize_validator_1 = require('./normalize_validator');
function controlPath(name, parent) {
  var p = collection_1.ListWrapper.clone(parent.path);
  p.push(name);
  return p;
}
exports.controlPath = controlPath;
function setUpControl(control, dir) {
  if (lang_1.isBlank(control))
    _throwError(dir, "Cannot find control");
  if (lang_1.isBlank(dir.valueAccessor))
    _throwError(dir, "No value accessor for");
  control.validator = validators_1.Validators.compose([control.validator, dir.validator]);
  control.asyncValidator = validators_1.Validators.composeAsync([control.asyncValidator, dir.asyncValidator]);
  dir.valueAccessor.writeValue(control.value);
  dir.valueAccessor.registerOnChange(function(newValue) {
    dir.viewToModelUpdate(newValue);
    control.updateValue(newValue, {emitModelToViewChange: false});
    control.markAsDirty();
  });
  control.registerOnChange(function(newValue) {
    return dir.valueAccessor.writeValue(newValue);
  });
  dir.valueAccessor.registerOnTouched(function() {
    return control.markAsTouched();
  });
}
exports.setUpControl = setUpControl;
function setUpControlGroup(control, dir) {
  if (lang_1.isBlank(control))
    _throwError(dir, "Cannot find control");
  control.validator = validators_1.Validators.compose([control.validator, dir.validator]);
  control.asyncValidator = validators_1.Validators.composeAsync([control.asyncValidator, dir.asyncValidator]);
}
exports.setUpControlGroup = setUpControlGroup;
function _throwError(dir, message) {
  var path = dir.path.join(" -> ");
  throw new exceptions_1.BaseException(message + " '" + path + "'");
}
function composeValidators(validators) {
  return lang_1.isPresent(validators) ? validators_1.Validators.compose(validators.map(normalize_validator_1.normalizeValidator)) : null;
}
exports.composeValidators = composeValidators;
function composeAsyncValidators(validators) {
  return lang_1.isPresent(validators) ? validators_1.Validators.composeAsync(validators.map(normalize_validator_1.normalizeValidator)) : null;
}
exports.composeAsyncValidators = composeAsyncValidators;
function isPropertyUpdated(changes, viewModel) {
  if (!collection_1.StringMapWrapper.contains(changes, "model"))
    return false;
  var change = changes["model"];
  if (change.isFirstChange())
    return true;
  return !lang_1.looseIdentical(viewModel, change.currentValue);
}
exports.isPropertyUpdated = isPropertyUpdated;
function selectValueAccessor(dir, valueAccessors) {
  if (lang_1.isBlank(valueAccessors))
    return null;
  var defaultAccessor;
  var builtinAccessor;
  var customAccessor;
  valueAccessors.forEach(function(v) {
    if (v instanceof default_value_accessor_1.DefaultValueAccessor) {
      defaultAccessor = v;
    } else if (v instanceof checkbox_value_accessor_1.CheckboxControlValueAccessor || v instanceof number_value_accessor_1.NumberValueAccessor || v instanceof select_control_value_accessor_1.SelectControlValueAccessor) {
      if (lang_1.isPresent(builtinAccessor))
        _throwError(dir, "More than one built-in value accessor matches");
      builtinAccessor = v;
    } else {
      if (lang_1.isPresent(customAccessor))
        _throwError(dir, "More than one custom value accessor matches");
      customAccessor = v;
    }
  });
  if (lang_1.isPresent(customAccessor))
    return customAccessor;
  if (lang_1.isPresent(builtinAccessor))
    return builtinAccessor;
  if (lang_1.isPresent(defaultAccessor))
    return defaultAccessor;
  _throwError(dir, "No valid value accessor for");
  return null;
}
exports.selectValueAccessor = selectValueAccessor;
