// Reflect.hasOwnMetadata ( metadataKey, target [, propertyKey] )
// - https://github.com/jonathandturner/decorators/blob/master/specs/metadata.md#reflecthasownmetadata--metadatakey-target--propertykey-

import "../../Reflect";
import * as assert from "assert";

export function ReflectHasOwnMetadataInvalidTarget() {
    assert.throws(() => Reflect.hasOwnMetadata("key", undefined, undefined), TypeError);
}

export function ReflectHasOwnMetadataWithoutTargetKeyWhenNotDefined() {
    let obj = {};
    let result = Reflect.hasOwnMetadata("key", obj, undefined);
    assert.equal(result, false);
}

export function ReflectHasOwnMetadataWithoutTargetKeyWhenDefined() {
    let obj = {};
    Reflect.defineMetadata("key", "value", obj, undefined);
    let result = Reflect.hasOwnMetadata("key", obj, undefined);
    assert.equal(result, true);
}

export function ReflectHasOwnMetadataWithoutTargetKeyWhenDefinedOnPrototype() {
    let prototype = {};
    let obj = Object.create(prototype);
    Reflect.defineMetadata("key", "value", prototype, undefined);
    let result = Reflect.hasOwnMetadata("key", obj, undefined);
    assert.equal(result, false);
}

export function ReflectHasOwnMetadataWithTargetKeyWhenNotDefined() {
    let obj = {};
    let result = Reflect.hasOwnMetadata("key", obj, "name");
    assert.equal(result, false);
}

export function ReflectHasOwnMetadataWithTargetKeyWhenDefined() {
    let obj = {};
    Reflect.defineMetadata("key", "value", obj, "name");
    let result = Reflect.hasOwnMetadata("key", obj, "name");
    assert.equal(result, true);
}

export function ReflectHasOwnMetadataWithTargetKeyWhenDefinedOnPrototype() {
    let prototype = {};
    let obj = Object.create(prototype);
    Reflect.defineMetadata("key", "value", prototype, "name");
    let result = Reflect.hasOwnMetadata("key", obj, "name");
    assert.equal(result, false);
}
