// Reflect.getMetadataKeys ( target [, propertyKey] )
// - https://github.com/jonathandturner/decorators/blob/master/specs/metadata.md#reflectgetmetadatakeys--target--propertykey-

import "../../Reflect";
import * as assert from "assert";

export function ReflectGetMetadataKeysInvalidTarget() {
    // 1. If Type(target) is not Object, throw a TypeError exception.
    assert.throws(() => Reflect.getMetadataKeys(undefined, undefined), TypeError);
}

export function ReflectGetMetadataKeysWithoutTargetKeyWhenNotDefined() {
    let obj = {};
    let result = Reflect.getMetadataKeys(obj, undefined);
    assert.deepEqual(result, []);
}

export function ReflectGetMetadataKeysWithoutTargetKeyWhenDefined() {
    let obj = {};
    Reflect.defineMetadata("key", "value", obj, undefined);
    let result = Reflect.getMetadataKeys(obj, undefined);
    assert.deepEqual(result, ["key"]);
}

export function ReflectGetMetadataKeysWithoutTargetKeyWhenDefinedOnPrototype() {
    let prototype = {};
    let obj = Object.create(prototype);
    Reflect.defineMetadata("key", "value", prototype, undefined);
    let result = Reflect.getMetadataKeys(obj, undefined);
    assert.deepEqual(result, ["key"]);
}

export function ReflectGetMetadataKeysOrderWithoutTargetKey() {
    let obj = {};
    Reflect.defineMetadata("key1", "value", obj, undefined);
    Reflect.defineMetadata("key0", "value", obj, undefined);
    let result = Reflect.getMetadataKeys(obj, undefined);
    assert.deepEqual(result, ["key1", "key0"]);
}

export function ReflectGetMetadataKeysOrderAfterRedefineWithoutTargetKey() {
    let obj = {};
    Reflect.defineMetadata("key1", "value", obj, undefined);
    Reflect.defineMetadata("key0", "value", obj, undefined);
    Reflect.defineMetadata("key1", "value", obj, undefined);
    let result = Reflect.getMetadataKeys(obj, undefined);
    assert.deepEqual(result, ["key1", "key0"]);
}

export function ReflectGetMetadataKeysOrderWithoutTargetKeyWhenDefinedOnPrototype() {
    let prototype = {};
    Reflect.defineMetadata("key2", "value", prototype, undefined);
    let obj = Object.create(prototype);
    Reflect.defineMetadata("key1", "value", obj, undefined);
    Reflect.defineMetadata("key0", "value", obj, undefined);
    let result = Reflect.getMetadataKeys(obj, undefined);
    assert.deepEqual(result, ["key1", "key0", "key2"]);
}

export function ReflectGetMetadataKeysWithTargetKeyWhenNotDefined() {
    let obj = {};
    let result = Reflect.getMetadataKeys(obj, "name");
    assert.deepEqual(result, []);
}

export function ReflectGetMetadataKeysWithTargetKeyWhenDefined() {
    let obj = {};
    Reflect.defineMetadata("key", "value", obj, "name");
    let result = Reflect.getMetadataKeys(obj, "name");
    assert.deepEqual(result, ["key"]);
}

export function ReflectGetMetadataKeysWithTargetKeyWhenDefinedOnPrototype() {
    let prototype = {};
    let obj = Object.create(prototype);
    Reflect.defineMetadata("key", "value", prototype, "name");
    let result = Reflect.getMetadataKeys(obj, "name");
    assert.deepEqual(result, ["key"]);
}

export function ReflectGetMetadataKeysOrderAfterRedefineWithTargetKey() {
    let obj = {};
    Reflect.defineMetadata("key1", "value", obj, "name");
    Reflect.defineMetadata("key0", "value", obj, "name");
    Reflect.defineMetadata("key1", "value", obj, "name");
    let result = Reflect.getMetadataKeys(obj, "name");
    assert.deepEqual(result, ["key1", "key0"]);
}

export function ReflectGetMetadataKeysOrderWithTargetKeyWhenDefinedOnPrototype() {
    let prototype = {};
    Reflect.defineMetadata("key2", "value", prototype, "name");
    let obj = Object.create(prototype);
    Reflect.defineMetadata("key1", "value", obj, "name");
    Reflect.defineMetadata("key0", "value", obj, "name");
    let result = Reflect.getMetadataKeys(obj, "name");
    assert.deepEqual(result, ["key1", "key0", "key2"]);
}