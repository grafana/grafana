/* */ 
require('../../Reflect');
var assert = require('assert');
function ReflectHasMetadataInvalidTarget() {
  assert.throws(function() {
    return Reflect.hasMetadata("key", undefined, undefined);
  }, TypeError);
}
exports.ReflectHasMetadataInvalidTarget = ReflectHasMetadataInvalidTarget;
function ReflectHasMetadataWithoutTargetKeyWhenNotDefined() {
  var obj = {};
  var result = Reflect.hasMetadata("key", obj, undefined);
  assert.equal(result, false);
}
exports.ReflectHasMetadataWithoutTargetKeyWhenNotDefined = ReflectHasMetadataWithoutTargetKeyWhenNotDefined;
function ReflectHasMetadataWithoutTargetKeyWhenDefined() {
  var obj = {};
  Reflect.defineMetadata("key", "value", obj, undefined);
  var result = Reflect.hasMetadata("key", obj, undefined);
  assert.equal(result, true);
}
exports.ReflectHasMetadataWithoutTargetKeyWhenDefined = ReflectHasMetadataWithoutTargetKeyWhenDefined;
function ReflectHasMetadataWithoutTargetKeyWhenDefinedOnPrototype() {
  var prototype = {};
  var obj = Object.create(prototype);
  Reflect.defineMetadata("key", "value", prototype, undefined);
  var result = Reflect.hasMetadata("key", obj, undefined);
  assert.equal(result, true);
}
exports.ReflectHasMetadataWithoutTargetKeyWhenDefinedOnPrototype = ReflectHasMetadataWithoutTargetKeyWhenDefinedOnPrototype;
function ReflectHasMetadataWithTargetKeyWhenNotDefined() {
  var obj = {};
  var result = Reflect.hasMetadata("key", obj, "name");
  assert.equal(result, false);
}
exports.ReflectHasMetadataWithTargetKeyWhenNotDefined = ReflectHasMetadataWithTargetKeyWhenNotDefined;
function ReflectHasMetadataWithTargetKeyWhenDefined() {
  var obj = {};
  Reflect.defineMetadata("key", "value", obj, "name");
  var result = Reflect.hasMetadata("key", obj, "name");
  assert.equal(result, true);
}
exports.ReflectHasMetadataWithTargetKeyWhenDefined = ReflectHasMetadataWithTargetKeyWhenDefined;
function ReflectHasMetadataWithTargetKeyWhenDefinedOnPrototype() {
  var prototype = {};
  var obj = Object.create(prototype);
  Reflect.defineMetadata("key", "value", prototype, "name");
  var result = Reflect.hasMetadata("key", obj, "name");
  assert.equal(result, true);
}
exports.ReflectHasMetadataWithTargetKeyWhenDefinedOnPrototype = ReflectHasMetadataWithTargetKeyWhenDefinedOnPrototype;
