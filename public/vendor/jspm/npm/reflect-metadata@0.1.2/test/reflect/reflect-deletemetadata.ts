// Reflect.deleteMetadata ( metadataKey, target [, propertyKey] )
// - https://github.com/jonathandturner/decorators/blob/master/specs/metadata.md#reflectdeletemetadata--metadatakey-target--propertykey-

import "../../Reflect";
import * as assert from "assert";

export function ReflectDeleteMetadataInvalidTarget() {
    assert.throws(() => Reflect.deleteMetadata("key", undefined, undefined), TypeError);
}

export function ReflectDeleteMetadataWhenNotDefinedWithoutTargetKey() {
    let obj = {};
    let result = Reflect.deleteMetadata("key", obj, undefined);
    assert.equal(result, false);
}

export function ReflectDeleteMetadataWhenDefinedWithoutTargetKey() {
    let obj = {};
    Reflect.defineMetadata("key", "value", obj, undefined);
    let result = Reflect.deleteMetadata("key", obj, undefined);
    assert.equal(result, true);
}

export function ReflectDeleteMetadataWhenDefinedOnPrototypeWithoutTargetKey() {
    let prototype = {};
    Reflect.defineMetadata("key", "value", prototype, undefined);
    let obj = Object.create(prototype);
    let result = Reflect.deleteMetadata("key", obj, undefined);
    assert.equal(result, false);
}

export function ReflectHasOwnMetadataAfterDeleteMetadata() {
    let obj = {};
    Reflect.defineMetadata("key", "value", obj, undefined);
    Reflect.deleteMetadata("key", obj, undefined);
    let result = Reflect.hasOwnMetadata("key", obj, undefined);
    assert.equal(result, false);
}