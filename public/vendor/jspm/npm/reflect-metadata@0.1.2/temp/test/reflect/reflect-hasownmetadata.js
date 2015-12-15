/* */ 
require('../../Reflect');
var assert = require('assert');
function ReflectHasOwnMetadataInvalidTarget() {
  assert.throws(function() {
    return Reflect.hasOwnMetadata("key", undefined, undefined);
  }, TypeError);
}
exports.ReflectHasOwnMetadataInvalidTarget = ReflectHasOwnMetadataInvalidTarget;
function ReflectHasOwnMetadataWithoutTargetKeyWhenNotDefined() {
  var obj = {};
  var result = Reflect.hasOwnMetadata("key", obj, undefined);
  assert.equal(result, false);
}
exports.ReflectHasOwnMetadataWithoutTargetKeyWhenNotDefined = ReflectHasOwnMetadataWithoutTargetKeyWhenNotDefined;
function ReflectHasOwnMetadataWithoutTargetKeyWhenDefined() {
  var obj = {};
  Reflect.defineMetadata("key", "value", obj, undefined);
  var result = Reflect.hasOwnMetadata("key", obj, undefined);
  assert.equal(result, true);
}
exports.ReflectHasOwnMetadataWithoutTargetKeyWhenDefined = ReflectHasOwnMetadataWithoutTargetKeyWhenDefined;
function ReflectHasOwnMetadataWithoutTargetKeyWhenDefinedOnPrototype() {
  var prototype = {};
  var obj = Object.create(prototype);
  Reflect.defineMetadata("key", "value", prototype, undefined);
  var result = Reflect.hasOwnMetadata("key", obj, undefined);
  assert.equal(result, false);
}
exports.ReflectHasOwnMetadataWithoutTargetKeyWhenDefinedOnPrototype = ReflectHasOwnMetadataWithoutTargetKeyWhenDefinedOnPrototype;
function ReflectHasOwnMetadataWithTargetKeyWhenNotDefined() {
  var obj = {};
  var result = Reflect.hasOwnMetadata("key", obj, "name");
  assert.equal(result, false);
}
exports.ReflectHasOwnMetadataWithTargetKeyWhenNotDefined = ReflectHasOwnMetadataWithTargetKeyWhenNotDefined;
function ReflectHasOwnMetadataWithTargetKeyWhenDefined() {
  var obj = {};
  Reflect.defineMetadata("key", "value", obj, "name");
  var result = Reflect.hasOwnMetadata("key", obj, "name");
  assert.equal(result, true);
}
exports.ReflectHasOwnMetadataWithTargetKeyWhenDefined = ReflectHasOwnMetadataWithTargetKeyWhenDefined;
function ReflectHasOwnMetadataWithTargetKeyWhenDefinedOnPrototype() {
  var prototype = {};
  var obj = Object.create(prototype);
  Reflect.defineMetadata("key", "value", prototype, "name");
  var result = Reflect.hasOwnMetadata("key", obj, "name");
  assert.equal(result, false);
}
exports.ReflectHasOwnMetadataWithTargetKeyWhenDefinedOnPrototype = ReflectHasOwnMetadataWithTargetKeyWhenDefinedOnPrototype;
