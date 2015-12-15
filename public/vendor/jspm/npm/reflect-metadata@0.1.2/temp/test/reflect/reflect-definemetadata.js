/* */ 
require('../../Reflect');
var assert = require('assert');
function ReflectDefineMetadataInvalidTarget() {
  assert.throws(function() {
    return Reflect.defineMetadata("key", "value", undefined, undefined);
  }, TypeError);
}
exports.ReflectDefineMetadataInvalidTarget = ReflectDefineMetadataInvalidTarget;
function ReflectDefineMetadataValidTargetWithoutTargetKey() {
  assert.doesNotThrow(function() {
    return Reflect.defineMetadata("key", "value", {}, undefined);
  });
}
exports.ReflectDefineMetadataValidTargetWithoutTargetKey = ReflectDefineMetadataValidTargetWithoutTargetKey;
function ReflectDefineMetadataValidTargetWithTargetKey() {
  assert.doesNotThrow(function() {
    return Reflect.defineMetadata("key", "value", {}, "name");
  });
}
exports.ReflectDefineMetadataValidTargetWithTargetKey = ReflectDefineMetadataValidTargetWithTargetKey;
