// Reflect.hasMetadata ( metadataKey, target [, propertyKey] )
// - https://github.com/jonathandturner/decorators/blob/master/specs/metadata.md#reflecthasmetadata--metadatakey-target--propertykey-

import "../../Reflect";
import * as assert from "assert";

export function ReflectHasMetadataInvalidTarget() {
    assert.throws(() => Reflect.hasMetadata("key", undefined, undefined), TypeError);
}

export function ReflectHasMetadataWithoutTargetKeyWhenNotDefined() {
    let obj = {};
    let result = Reflect.hasMetadata("key", obj, undefined);
    assert.equal(result, false);
}

export function ReflectHasMetadataWithoutTargetKeyWhenDefined() {
    let obj = {};
    Reflect.defineMetadata("key", "value", obj, undefined);
    let result = Reflect.hasMetadata("key", obj, undefined);
    assert.equal(result, true);
}

export function ReflectHasMetadataWithoutTargetKeyWhenDefinedOnPrototype() {
    let prototype = {};
    let obj = Object.create(prototype);
    Reflect.defineMetadata("key", "value", prototype, undefined);
    let result = Reflect.hasMetadata("key", obj, undefined);
    assert.equal(result, true);
}

export function ReflectHasMetadataWithTargetKeyWhenNotDefined() {
    let obj = {};
    let result = Reflect.hasMetadata("key", obj, "name");
    assert.equal(result, false);
}

export function ReflectHasMetadataWithTargetKeyWhenDefined() {
    let obj = {};
    Reflect.defineMetadata("key", "value", obj, "name");
    let result = Reflect.hasMetadata("key", obj, "name");
    assert.equal(result, true);
}

export function ReflectHasMetadataWithTargetKeyWhenDefinedOnPrototype() {
    let prototype = {};
    let obj = Object.create(prototype);
    Reflect.defineMetadata("key", "value", prototype, "name");
    let result = Reflect.hasMetadata("key", obj, "name");
    assert.equal(result, true);
}