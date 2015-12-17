// Reflect.getMetadataKeys ( target [, propertyKey] )
// - https://github.com/jonathandturner/decorators/blob/master/specs/metadata.md#reflectgetmetadatakeys--target--propertykey-
require("../../Reflect");
var assert = require("assert");
function ReflectGetMetadataKeysInvalidTarget() {
    // 1. If Type(target) is not Object, throw a TypeError exception.
    assert.throws(function () { return Reflect.getMetadataKeys(undefined, undefined); }, TypeError);
}
exports.ReflectGetMetadataKeysInvalidTarget = ReflectGetMetadataKeysInvalidTarget;
function ReflectGetMetadataKeysWithoutTargetKeyWhenNotDefined() {
    var obj = {};
    var result = Reflect.getMetadataKeys(obj, undefined);
    assert.deepEqual(result, []);
}
exports.ReflectGetMetadataKeysWithoutTargetKeyWhenNotDefined = ReflectGetMetadataKeysWithoutTargetKeyWhenNotDefined;
function ReflectGetMetadataKeysWithoutTargetKeyWhenDefined() {
    var obj = {};
    Reflect.defineMetadata("key", "value", obj, undefined);
    var result = Reflect.getMetadataKeys(obj, undefined);
    assert.deepEqual(result, ["key"]);
}
exports.ReflectGetMetadataKeysWithoutTargetKeyWhenDefined = ReflectGetMetadataKeysWithoutTargetKeyWhenDefined;
function ReflectGetMetadataKeysWithoutTargetKeyWhenDefinedOnPrototype() {
    var prototype = {};
    var obj = Object.create(prototype);
    Reflect.defineMetadata("key", "value", prototype, undefined);
    var result = Reflect.getMetadataKeys(obj, undefined);
    assert.deepEqual(result, ["key"]);
}
exports.ReflectGetMetadataKeysWithoutTargetKeyWhenDefinedOnPrototype = ReflectGetMetadataKeysWithoutTargetKeyWhenDefinedOnPrototype;
function ReflectGetMetadataKeysOrderWithoutTargetKey() {
    var obj = {};
    Reflect.defineMetadata("key1", "value", obj, undefined);
    Reflect.defineMetadata("key0", "value", obj, undefined);
    var result = Reflect.getMetadataKeys(obj, undefined);
    assert.deepEqual(result, ["key1", "key0"]);
}
exports.ReflectGetMetadataKeysOrderWithoutTargetKey = ReflectGetMetadataKeysOrderWithoutTargetKey;
function ReflectGetMetadataKeysOrderAfterRedefineWithoutTargetKey() {
    var obj = {};
    Reflect.defineMetadata("key1", "value", obj, undefined);
    Reflect.defineMetadata("key0", "value", obj, undefined);
    Reflect.defineMetadata("key1", "value", obj, undefined);
    var result = Reflect.getMetadataKeys(obj, undefined);
    assert.deepEqual(result, ["key1", "key0"]);
}
exports.ReflectGetMetadataKeysOrderAfterRedefineWithoutTargetKey = ReflectGetMetadataKeysOrderAfterRedefineWithoutTargetKey;
function ReflectGetMetadataKeysOrderWithoutTargetKeyWhenDefinedOnPrototype() {
    var prototype = {};
    Reflect.defineMetadata("key2", "value", prototype, undefined);
    var obj = Object.create(prototype);
    Reflect.defineMetadata("key1", "value", obj, undefined);
    Reflect.defineMetadata("key0", "value", obj, undefined);
    var result = Reflect.getMetadataKeys(obj, undefined);
    assert.deepEqual(result, ["key1", "key0", "key2"]);
}
exports.ReflectGetMetadataKeysOrderWithoutTargetKeyWhenDefinedOnPrototype = ReflectGetMetadataKeysOrderWithoutTargetKeyWhenDefinedOnPrototype;
function ReflectGetMetadataKeysWithTargetKeyWhenNotDefined() {
    var obj = {};
    var result = Reflect.getMetadataKeys(obj, "name");
    assert.deepEqual(result, []);
}
exports.ReflectGetMetadataKeysWithTargetKeyWhenNotDefined = ReflectGetMetadataKeysWithTargetKeyWhenNotDefined;
function ReflectGetMetadataKeysWithTargetKeyWhenDefined() {
    var obj = {};
    Reflect.defineMetadata("key", "value", obj, "name");
    var result = Reflect.getMetadataKeys(obj, "name");
    assert.deepEqual(result, ["key"]);
}
exports.ReflectGetMetadataKeysWithTargetKeyWhenDefined = ReflectGetMetadataKeysWithTargetKeyWhenDefined;
function ReflectGetMetadataKeysWithTargetKeyWhenDefinedOnPrototype() {
    var prototype = {};
    var obj = Object.create(prototype);
    Reflect.defineMetadata("key", "value", prototype, "name");
    var result = Reflect.getMetadataKeys(obj, "name");
    assert.deepEqual(result, ["key"]);
}
exports.ReflectGetMetadataKeysWithTargetKeyWhenDefinedOnPrototype = ReflectGetMetadataKeysWithTargetKeyWhenDefinedOnPrototype;
function ReflectGetMetadataKeysOrderAfterRedefineWithTargetKey() {
    var obj = {};
    Reflect.defineMetadata("key1", "value", obj, "name");
    Reflect.defineMetadata("key0", "value", obj, "name");
    Reflect.defineMetadata("key1", "value", obj, "name");
    var result = Reflect.getMetadataKeys(obj, "name");
    assert.deepEqual(result, ["key1", "key0"]);
}
exports.ReflectGetMetadataKeysOrderAfterRedefineWithTargetKey = ReflectGetMetadataKeysOrderAfterRedefineWithTargetKey;
function ReflectGetMetadataKeysOrderWithTargetKeyWhenDefinedOnPrototype() {
    var prototype = {};
    Reflect.defineMetadata("key2", "value", prototype, "name");
    var obj = Object.create(prototype);
    Reflect.defineMetadata("key1", "value", obj, "name");
    Reflect.defineMetadata("key0", "value", obj, "name");
    var result = Reflect.getMetadataKeys(obj, "name");
    assert.deepEqual(result, ["key1", "key0", "key2"]);
}
exports.ReflectGetMetadataKeysOrderWithTargetKeyWhenDefinedOnPrototype = ReflectGetMetadataKeysOrderWithTargetKeyWhenDefinedOnPrototype;
//# sourceMappingURL=reflect-getmetadatakeys.js.map