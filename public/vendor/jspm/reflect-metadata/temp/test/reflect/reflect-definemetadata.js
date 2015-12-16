// Reflect.defineMetadata ( metadataKey, metadataValue, target, propertyKey )
// - https://github.com/jonathandturner/decorators/blob/master/specs/metadata.md#reflectdefinemetadata--metadatakey-metadatavalue-target-propertykey-    
require("../../Reflect");
var assert = require("assert");
function ReflectDefineMetadataInvalidTarget() {
    assert.throws(function () { return Reflect.defineMetadata("key", "value", undefined, undefined); }, TypeError);
}
exports.ReflectDefineMetadataInvalidTarget = ReflectDefineMetadataInvalidTarget;
function ReflectDefineMetadataValidTargetWithoutTargetKey() {
    assert.doesNotThrow(function () { return Reflect.defineMetadata("key", "value", {}, undefined); });
}
exports.ReflectDefineMetadataValidTargetWithoutTargetKey = ReflectDefineMetadataValidTargetWithoutTargetKey;
function ReflectDefineMetadataValidTargetWithTargetKey() {
    assert.doesNotThrow(function () { return Reflect.defineMetadata("key", "value", {}, "name"); });
}
exports.ReflectDefineMetadataValidTargetWithTargetKey = ReflectDefineMetadataValidTargetWithTargetKey;
//# sourceMappingURL=reflect-definemetadata.js.map