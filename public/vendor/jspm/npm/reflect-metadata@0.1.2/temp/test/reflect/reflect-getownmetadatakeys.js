/* */ 
require('../../Reflect');
var assert = require('assert');
function ReflectGetOwnMetadataKeysKeysInvalidTarget() {
  assert.throws(function() {
    return Reflect.getOwnMetadataKeys(undefined, undefined);
  }, TypeError);
}
exports.ReflectGetOwnMetadataKeysKeysInvalidTarget = ReflectGetOwnMetadataKeysKeysInvalidTarget;
function ReflectGetOwnMetadataKeysWithoutTargetKeyWhenNotDefined() {
  var obj = {};
  var result = Reflect.getOwnMetadataKeys(obj, undefined);
  assert.deepEqual(result, []);
}
exports.ReflectGetOwnMetadataKeysWithoutTargetKeyWhenNotDefined = ReflectGetOwnMetadataKeysWithoutTargetKeyWhenNotDefined;
function ReflectGetOwnMetadataKeysWithoutTargetKeyWhenDefined() {
  var obj = {};
  Reflect.defineMetadata("key", "value", obj, undefined);
  var result = Reflect.getOwnMetadataKeys(obj, undefined);
  assert.deepEqual(result, ["key"]);
}
exports.ReflectGetOwnMetadataKeysWithoutTargetKeyWhenDefined = ReflectGetOwnMetadataKeysWithoutTargetKeyWhenDefined;
function ReflectGetOwnMetadataKeysWithoutTargetKeyWhenDefinedOnPrototype() {
  var prototype = {};
  var obj = Object.create(prototype);
  Reflect.defineMetadata("key", "value", prototype, undefined);
  var result = Reflect.getOwnMetadataKeys(obj, undefined);
  assert.deepEqual(result, []);
}
exports.ReflectGetOwnMetadataKeysWithoutTargetKeyWhenDefinedOnPrototype = ReflectGetOwnMetadataKeysWithoutTargetKeyWhenDefinedOnPrototype;
function ReflectGetOwnMetadataKeysOrderWithoutTargetKey() {
  var obj = {};
  Reflect.defineMetadata("key1", "value", obj, undefined);
  Reflect.defineMetadata("key0", "value", obj, undefined);
  var result = Reflect.getOwnMetadataKeys(obj, undefined);
  assert.deepEqual(result, ["key1", "key0"]);
}
exports.ReflectGetOwnMetadataKeysOrderWithoutTargetKey = ReflectGetOwnMetadataKeysOrderWithoutTargetKey;
function ReflectGetOwnMetadataKeysOrderAfterRedefineWithoutTargetKey() {
  var obj = {};
  Reflect.defineMetadata("key1", "value", obj, undefined);
  Reflect.defineMetadata("key0", "value", obj, undefined);
  Reflect.defineMetadata("key1", "value", obj, undefined);
  var result = Reflect.getOwnMetadataKeys(obj, undefined);
  assert.deepEqual(result, ["key1", "key0"]);
}
exports.ReflectGetOwnMetadataKeysOrderAfterRedefineWithoutTargetKey = ReflectGetOwnMetadataKeysOrderAfterRedefineWithoutTargetKey;
function ReflectGetOwnMetadataKeysWithTargetKeyWhenNotDefined() {
  var obj = {};
  var result = Reflect.getOwnMetadataKeys(obj, "name");
  assert.deepEqual(result, []);
}
exports.ReflectGetOwnMetadataKeysWithTargetKeyWhenNotDefined = ReflectGetOwnMetadataKeysWithTargetKeyWhenNotDefined;
function ReflectGetOwnMetadataKeysWithTargetKeyWhenDefined() {
  var obj = {};
  Reflect.defineMetadata("key", "value", obj, "name");
  var result = Reflect.getOwnMetadataKeys(obj, "name");
  assert.deepEqual(result, ["key"]);
}
exports.ReflectGetOwnMetadataKeysWithTargetKeyWhenDefined = ReflectGetOwnMetadataKeysWithTargetKeyWhenDefined;
function ReflectGetOwnMetadataKeysWithTargetKeyWhenDefinedOnPrototype() {
  var prototype = {};
  var obj = Object.create(prototype);
  Reflect.defineMetadata("key", "value", prototype, "name");
  var result = Reflect.getOwnMetadataKeys(obj, "name");
  assert.deepEqual(result, []);
}
exports.ReflectGetOwnMetadataKeysWithTargetKeyWhenDefinedOnPrototype = ReflectGetOwnMetadataKeysWithTargetKeyWhenDefinedOnPrototype;
function ReflectGetOwnMetadataKeysOrderAfterRedefineWithTargetKey() {
  var obj = {};
  Reflect.defineMetadata("key1", "value", obj, "name");
  Reflect.defineMetadata("key0", "value", obj, "name");
  Reflect.defineMetadata("key1", "value", obj, "name");
  var result = Reflect.getOwnMetadataKeys(obj, "name");
  assert.deepEqual(result, ["key1", "key0"]);
}
exports.ReflectGetOwnMetadataKeysOrderAfterRedefineWithTargetKey = ReflectGetOwnMetadataKeysOrderAfterRedefineWithTargetKey;
