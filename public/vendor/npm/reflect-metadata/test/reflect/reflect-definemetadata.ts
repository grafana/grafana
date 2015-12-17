// Reflect.defineMetadata ( metadataKey, metadataValue, target, propertyKey )
// - https://github.com/jonathandturner/decorators/blob/master/specs/metadata.md#reflectdefinemetadata--metadatakey-metadatavalue-target-propertykey-    

import "../../Reflect";
import * as assert from "assert";

export function ReflectDefineMetadataInvalidTarget() {
    assert.throws(() => Reflect.defineMetadata("key", "value", undefined, undefined), TypeError);
}

export function ReflectDefineMetadataValidTargetWithoutTargetKey() {
    assert.doesNotThrow(() => Reflect.defineMetadata("key", "value", { }, undefined));
}

export function ReflectDefineMetadataValidTargetWithTargetKey() {
    assert.doesNotThrow(() => Reflect.defineMetadata("key", "value", { }, "name"));
}