// Reflect.getOwnMetadata ( metadataKey, target [, propertyKey] )
// - https://github.com/jonathandturner/decorators/blob/master/specs/metadata.md#reflectgetownmetadata--metadatakey-target--propertykey-

import "../../Reflect";
import * as assert from "assert";

export function ReflectGetOwnMetadataInvalidTarget() {
    assert.throws(() => Reflect.getOwnMetadata("key", undefined, undefined), TypeError);
}

export function ReflectGetOwnMetadataWithoutTargetKeyWhenNotDefined() {
    let obj = {};
    let result = Reflect.getOwnMetadata("key", obj, undefined);
    assert.equal(result, undefined);
}

export function ReflectGetOwnMetadataWithoutTargetKeyWhenDefined() {
    let obj = {};
    Reflect.defineMetadata("key", "value", obj, undefined);
    let result = Reflect.getOwnMetadata("key", obj, undefined);
    assert.equal(result, "value");
}

export function ReflectGetOwnMetadataWithoutTargetKeyWhenDefinedOnPrototype() {
    let prototype = {};
    let obj = Object.create(prototype);
    Reflect.defineMetadata("key", "value", prototype, undefined);
    let result = Reflect.getOwnMetadata("key", obj, undefined);
    assert.equal(result, undefined);
}

export function ReflectGetOwnMetadataWithTargetKeyWhenNotDefined() {
    let obj = {};
    let result = Reflect.getOwnMetadata("key", obj, "name");
    assert.equal(result, undefined);
}

export function ReflectGetOwnMetadataWithTargetKeyWhenDefined() {
    let obj = {};
    Reflect.defineMetadata("key", "value", obj, "name");
    let result = Reflect.getOwnMetadata("key", obj, "name");
    assert.equal(result, "value");
}

export function ReflectGetOwnMetadataWithTargetKeyWhenDefinedOnPrototype() {
    let prototype = {};
    let obj = Object.create(prototype);
    Reflect.defineMetadata("key", "value", prototype, "name");
    let result = Reflect.getOwnMetadata("key", obj, "name");
    assert.equal(result, undefined);
}
