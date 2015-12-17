// Reflect.getMetadata ( metadataKey, target [, propertyKey] )
// - https://github.com/jonathandturner/decorators/blob/master/specs/metadata.md#reflectgetmetadata--metadatakey-target--propertykey-

import "../../Reflect";
import * as assert from "assert";

export function ReflectGetMetadataInvalidTarget() {
    assert.throws(() => Reflect.getMetadata("key", undefined, undefined), TypeError);
}

export function ReflectGetMetadataWithoutTargetKeyWhenNotDefined() {
    let obj = {};
    let result = Reflect.getMetadata("key", obj, undefined);
    assert.equal(result, undefined);
}

export function ReflectGetMetadataWithoutTargetKeyWhenDefined() {
    let obj = {};
    Reflect.defineMetadata("key", "value", obj, undefined);
    let result = Reflect.getMetadata("key", obj, undefined);
    assert.equal(result, "value");
}

export function ReflectGetMetadataWithoutTargetKeyWhenDefinedOnPrototype() {
    let prototype = {};
    let obj = Object.create(prototype);
    Reflect.defineMetadata("key", "value", prototype, undefined);
    let result = Reflect.getMetadata("key", obj, undefined);
    assert.equal(result, "value");
}

export function ReflectGetMetadataWithTargetKeyWhenNotDefined() {
    let obj = {};
    let result = Reflect.getMetadata("key", obj, "name");
    assert.equal(result, undefined);
}

export function ReflectGetMetadataWithTargetKeyWhenDefined() {
    let obj = {};
    Reflect.defineMetadata("key", "value", obj, "name");
    let result = Reflect.getMetadata("key", obj, "name");
    assert.equal(result, "value");
}

export function ReflectGetMetadataWithTargetKeyWhenDefinedOnPrototype() {
    let prototype = {};
    let obj = Object.create(prototype);
    Reflect.defineMetadata("key", "value", prototype, "name");
    let result = Reflect.getMetadata("key", obj, "name");
    assert.equal(result, "value");
}
