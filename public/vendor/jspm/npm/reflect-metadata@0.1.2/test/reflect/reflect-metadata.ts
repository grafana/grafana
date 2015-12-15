// Reflect.metadata ( metadataKey, metadataValue )
// - https://github.com/jonathandturner/decorators/blob/master/specs/metadata.md#reflectmetadata--metadatakey-metadatavalue-

import "../../Reflect";
import * as assert from "assert";

export function ReflectMetadataReturnsDecoratorFunction() {
    let result = Reflect.metadata("key", "value");
    assert.equal(typeof result, "function");
}

export function ReflectMetadataDecoratorThrowsWithInvalidTargetWithTargetKey() {
    let decorator = Reflect.metadata("key", "value");
    assert.throws(() => decorator(undefined, "name"), TypeError);
}

export function ReflectMetadataDecoratorThrowsWithInvalidTargetWithoutTargetKey() {
    let decorator = Reflect.metadata("key", "value");
    assert.throws(() => decorator({}, undefined), TypeError);
}

export function ReflectMetadataDecoratorSetsMetadataOnTargetWithoutTargetKey() {
    let decorator = Reflect.metadata("key", "value");
    let target = function () {}
    decorator(target);

    let result = Reflect.hasOwnMetadata("key", target, undefined);
    assert.equal(result, true);
}

export function ReflectMetadataDecoratorSetsMetadataOnTargetWithTargetKey() {
    let decorator = Reflect.metadata("key", "value");
    let target = {}
    decorator(target, "name");

    let result = Reflect.hasOwnMetadata("key", target, "name");
    assert.equal(result, true);
}