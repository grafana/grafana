// Reflect.metadata ( metadataKey, metadataValue )
// - https://github.com/jonathandturner/decorators/blob/master/specs/metadata.md#reflectmetadata--metadatakey-metadatavalue-
require("../../Reflect");
var assert = require("assert");
function ReflectMetadataReturnsDecoratorFunction() {
    var result = Reflect.metadata("key", "value");
    assert.equal(typeof result, "function");
}
exports.ReflectMetadataReturnsDecoratorFunction = ReflectMetadataReturnsDecoratorFunction;
function ReflectMetadataDecoratorThrowsWithInvalidTargetWithTargetKey() {
    var decorator = Reflect.metadata("key", "value");
    assert.throws(function () { return decorator(undefined, "name"); }, TypeError);
}
exports.ReflectMetadataDecoratorThrowsWithInvalidTargetWithTargetKey = ReflectMetadataDecoratorThrowsWithInvalidTargetWithTargetKey;
function ReflectMetadataDecoratorThrowsWithInvalidTargetWithoutTargetKey() {
    var decorator = Reflect.metadata("key", "value");
    assert.throws(function () { return decorator({}, undefined); }, TypeError);
}
exports.ReflectMetadataDecoratorThrowsWithInvalidTargetWithoutTargetKey = ReflectMetadataDecoratorThrowsWithInvalidTargetWithoutTargetKey;
function ReflectMetadataDecoratorSetsMetadataOnTargetWithoutTargetKey() {
    var decorator = Reflect.metadata("key", "value");
    var target = function () { };
    decorator(target);
    var result = Reflect.hasOwnMetadata("key", target, undefined);
    assert.equal(result, true);
}
exports.ReflectMetadataDecoratorSetsMetadataOnTargetWithoutTargetKey = ReflectMetadataDecoratorSetsMetadataOnTargetWithoutTargetKey;
function ReflectMetadataDecoratorSetsMetadataOnTargetWithTargetKey() {
    var decorator = Reflect.metadata("key", "value");
    var target = {};
    decorator(target, "name");
    var result = Reflect.hasOwnMetadata("key", target, "name");
    assert.equal(result, true);
}
exports.ReflectMetadataDecoratorSetsMetadataOnTargetWithTargetKey = ReflectMetadataDecoratorSetsMetadataOnTargetWithTargetKey;
//# sourceMappingURL=reflect-metadata.js.map