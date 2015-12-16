// Reflect.getMetadata ( metadataKey, target [, propertyKey] )
// - https://github.com/jonathandturner/decorators/blob/master/specs/metadata.md#reflectgetmetadata--metadatakey-target--propertykey-
require("../../Reflect");
var assert = require("assert");
function ReflectGetMetadataInvalidTarget() {
    assert.throws(function () { return Reflect.getMetadata("key", undefined, undefined); }, TypeError);
}
exports.ReflectGetMetadataInvalidTarget = ReflectGetMetadataInvalidTarget;
function ReflectGetMetadataWithoutTargetKeyWhenNotDefined() {
    var obj = {};
    var result = Reflect.getMetadata("key", obj, undefined);
    assert.equal(result, undefined);
}
exports.ReflectGetMetadataWithoutTargetKeyWhenNotDefined = ReflectGetMetadataWithoutTargetKeyWhenNotDefined;
function ReflectGetMetadataWithoutTargetKeyWhenDefined() {
    var obj = {};
    Reflect.defineMetadata("key", "value", obj, undefined);
    var result = Reflect.getMetadata("key", obj, undefined);
    assert.equal(result, "value");
}
exports.ReflectGetMetadataWithoutTargetKeyWhenDefined = ReflectGetMetadataWithoutTargetKeyWhenDefined;
function ReflectGetMetadataWithoutTargetKeyWhenDefinedOnPrototype() {
    var prototype = {};
    var obj = Object.create(prototype);
    Reflect.defineMetadata("key", "value", prototype, undefined);
    var result = Reflect.getMetadata("key", obj, undefined);
    assert.equal(result, "value");
}
exports.ReflectGetMetadataWithoutTargetKeyWhenDefinedOnPrototype = ReflectGetMetadataWithoutTargetKeyWhenDefinedOnPrototype;
function ReflectGetMetadataWithTargetKeyWhenNotDefined() {
    var obj = {};
    var result = Reflect.getMetadata("key", obj, "name");
    assert.equal(result, undefined);
}
exports.ReflectGetMetadataWithTargetKeyWhenNotDefined = ReflectGetMetadataWithTargetKeyWhenNotDefined;
function ReflectGetMetadataWithTargetKeyWhenDefined() {
    var obj = {};
    Reflect.defineMetadata("key", "value", obj, "name");
    var result = Reflect.getMetadata("key", obj, "name");
    assert.equal(result, "value");
}
exports.ReflectGetMetadataWithTargetKeyWhenDefined = ReflectGetMetadataWithTargetKeyWhenDefined;
function ReflectGetMetadataWithTargetKeyWhenDefinedOnPrototype() {
    var prototype = {};
    var obj = Object.create(prototype);
    Reflect.defineMetadata("key", "value", prototype, "name");
    var result = Reflect.getMetadata("key", obj, "name");
    assert.equal(result, "value");
}
exports.ReflectGetMetadataWithTargetKeyWhenDefinedOnPrototype = ReflectGetMetadataWithTargetKeyWhenDefinedOnPrototype;
//# sourceMappingURL=reflect-getmetadata.js.map