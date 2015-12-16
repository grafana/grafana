// Reflect.getOwnMetadataKeysKeys ( target [, propertyKey] )
// - https://github.com/jonathandturner/decorators/blob/master/specs/metadata.md#reflectgetownmetadatakeyskeys--target--propertykey-

import "../../Reflect";
import * as assert from "assert";

export function ReflectGetOwnMetadataKeysKeysInvalidTarget() {
    // 1. If Type(target) is not Object, throw a TypeError exception.
    assert.throws(() => Reflect.getOwnMetadataKeys(undefined, undefined), TypeError);
}

export function ReflectGetOwnMetadataKeysWithoutTargetKeyWhenNotDefined() {
    let obj = {};
    let result = Reflect.getOwnMetadataKeys(obj, undefined);
    assert.deepEqual(result, []);
}

export function ReflectGetOwnMetadataKeysWithoutTargetKeyWhenDefined() {
    let obj = {};
    Reflect.defineMetadata("key", "value", obj, undefined);
    let result = Reflect.getOwnMetadataKeys(obj, undefined);
    assert.deepEqual(result, ["key"]);
}

export function ReflectGetOwnMetadataKeysWithoutTargetKeyWhenDefinedOnPrototype() {
    let prototype = {};
    let obj = Object.create(prototype);
    Reflect.defineMetadata("key", "value", prototype, undefined);
    let result = Reflect.getOwnMetadataKeys(obj, undefined);
    assert.deepEqual(result, []);
}

export function ReflectGetOwnMetadataKeysOrderWithoutTargetKey() {
    let obj = {};
    Reflect.defineMetadata("key1", "value", obj, undefined);
    Reflect.defineMetadata("key0", "value", obj, undefined);
    let result = Reflect.getOwnMetadataKeys(obj, undefined);
    assert.deepEqual(result, ["key1", "key0"]);
}

export function ReflectGetOwnMetadataKeysOrderAfterRedefineWithoutTargetKey() {
    let obj = {};
    Reflect.defineMetadata("key1", "value", obj, undefined);
    Reflect.defineMetadata("key0", "value", obj, undefined);
    Reflect.defineMetadata("key1", "value", obj, undefined);
    let result = Reflect.getOwnMetadataKeys(obj, undefined);
    assert.deepEqual(result, ["key1", "key0"]);
}

export function ReflectGetOwnMetadataKeysWithTargetKeyWhenNotDefined() {
    let obj = {};
    let result = Reflect.getOwnMetadataKeys(obj, "name");
    assert.deepEqual(result, []);
}

export function ReflectGetOwnMetadataKeysWithTargetKeyWhenDefined() {
    let obj = {};
    Reflect.defineMetadata("key", "value", obj, "name");
    let result = Reflect.getOwnMetadataKeys(obj, "name");
    assert.deepEqual(result, ["key"]);
}

export function ReflectGetOwnMetadataKeysWithTargetKeyWhenDefinedOnPrototype() {
    let prototype = {};
    let obj = Object.create(prototype);
    Reflect.defineMetadata("key", "value", prototype, "name");
    let result = Reflect.getOwnMetadataKeys(obj, "name");
    assert.deepEqual(result, []);
}

export function ReflectGetOwnMetadataKeysOrderAfterRedefineWithTargetKey() {
    let obj = {};
    Reflect.defineMetadata("key1", "value", obj, "name");
    Reflect.defineMetadata("key0", "value", obj, "name");
    Reflect.defineMetadata("key1", "value", obj, "name");
    let result = Reflect.getOwnMetadataKeys(obj, "name");
    assert.deepEqual(result, ["key1", "key0"]);
}