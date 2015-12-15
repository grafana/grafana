/* */ 
require('../../Reflect');
var assert = require('assert');
function ReflectGetOwnMetadataInvalidTarget() {
  assert.throws(function() {
    return Reflect.getOwnMetadata("key", undefined, undefined);
  }, TypeError);
}
exports.ReflectGetOwnMetadataInvalidTarget = ReflectGetOwnMetadataInvalidTarget;
function ReflectGetOwnMetadataWithoutTargetKeyWhenNotDefined() {
  var obj = {};
  var result = Reflect.getOwnMetadata("key", obj, undefined);
  assert.equal(result, undefined);
}
exports.ReflectGetOwnMetadataWithoutTargetKeyWhenNotDefined = ReflectGetOwnMetadataWithoutTargetKeyWhenNotDefined;
function ReflectGetOwnMetadataWithoutTargetKeyWhenDefined() {
  var obj = {};
  Reflect.defineMetadata("key", "value", obj, undefined);
  var result = Reflect.getOwnMetadata("key", obj, undefined);
  assert.equal(result, "value");
}
exports.ReflectGetOwnMetadataWithoutTargetKeyWhenDefined = ReflectGetOwnMetadataWithoutTargetKeyWhenDefined;
function ReflectGetOwnMetadataWithoutTargetKeyWhenDefinedOnPrototype() {
  var prototype = {};
  var obj = Object.create(prototype);
  Reflect.defineMetadata("key", "value", prototype, undefined);
  var result = Reflect.getOwnMetadata("key", obj, undefined);
  assert.equal(result, undefined);
}
exports.ReflectGetOwnMetadataWithoutTargetKeyWhenDefinedOnPrototype = ReflectGetOwnMetadataWithoutTargetKeyWhenDefinedOnPrototype;
function ReflectGetOwnMetadataWithTargetKeyWhenNotDefined() {
  var obj = {};
  var result = Reflect.getOwnMetadata("key", obj, "name");
  assert.equal(result, undefined);
}
exports.ReflectGetOwnMetadataWithTargetKeyWhenNotDefined = ReflectGetOwnMetadataWithTargetKeyWhenNotDefined;
function ReflectGetOwnMetadataWithTargetKeyWhenDefined() {
  var obj = {};
  Reflect.defineMetadata("key", "value", obj, "name");
  var result = Reflect.getOwnMetadata("key", obj, "name");
  assert.equal(result, "value");
}
exports.ReflectGetOwnMetadataWithTargetKeyWhenDefined = ReflectGetOwnMetadataWithTargetKeyWhenDefined;
function ReflectGetOwnMetadataWithTargetKeyWhenDefinedOnPrototype() {
  var prototype = {};
  var obj = Object.create(prototype);
  Reflect.defineMetadata("key", "value", prototype, "name");
  var result = Reflect.getOwnMetadata("key", obj, "name");
  assert.equal(result, undefined);
}
exports.ReflectGetOwnMetadataWithTargetKeyWhenDefinedOnPrototype = ReflectGetOwnMetadataWithTargetKeyWhenDefinedOnPrototype;
