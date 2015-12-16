// Reflect.deleteMetadata ( metadataKey, target [, propertyKey] )
// - https://github.com/jonathandturner/decorators/blob/master/specs/metadata.md#reflectdeletemetadata--metadatakey-target--propertykey-
require("../../Reflect");
var assert = require("assert");
function ReflectDeleteMetadataInvalidTarget() {
    assert.throws(function () { return Reflect.deleteMetadata("key", undefined, undefined); }, TypeError);
}
exports.ReflectDeleteMetadataInvalidTarget = ReflectDeleteMetadataInvalidTarget;
function ReflectDeleteMetadataWhenNotDefinedWithoutTargetKey() {
    var obj = {};
    var result = Reflect.deleteMetadata("key", obj, undefined);
    assert.equal(result, false);
}
exports.ReflectDeleteMetadataWhenNotDefinedWithoutTargetKey = ReflectDeleteMetadataWhenNotDefinedWithoutTargetKey;
function ReflectDeleteMetadataWhenDefinedWithoutTargetKey() {
    var obj = {};
    Reflect.defineMetadata("key", "value", obj, undefined);
    var result = Reflect.deleteMetadata("key", obj, undefined);
    assert.equal(result, true);
}
exports.ReflectDeleteMetadataWhenDefinedWithoutTargetKey = ReflectDeleteMetadataWhenDefinedWithoutTargetKey;
function ReflectDeleteMetadataWhenDefinedOnPrototypeWithoutTargetKey() {
    var prototype = {};
    Reflect.defineMetadata("key", "value", prototype, undefined);
    var obj = Object.create(prototype);
    var result = Reflect.deleteMetadata("key", obj, undefined);
    assert.equal(result, false);
}
exports.ReflectDeleteMetadataWhenDefinedOnPrototypeWithoutTargetKey = ReflectDeleteMetadataWhenDefinedOnPrototypeWithoutTargetKey;
function ReflectHasOwnMetadataAfterDeleteMetadata() {
    var obj = {};
    Reflect.defineMetadata("key", "value", obj, undefined);
    Reflect.deleteMetadata("key", obj, undefined);
    var result = Reflect.hasOwnMetadata("key", obj, undefined);
    assert.equal(result, false);
}
exports.ReflectHasOwnMetadataAfterDeleteMetadata = ReflectHasOwnMetadataAfterDeleteMetadata;
//# sourceMappingURL=reflect-deletemetadata.js.map