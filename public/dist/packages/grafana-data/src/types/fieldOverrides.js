/**
 * Guard functionality to check if an override rule is of type {@link SystemConfigOverrideRule}.
 * It will only return true if the {@link SystemConfigOverrideRule} has the passed systemRef.
 *
 * @param ref system override reference
 * @internal
 */
export function isSystemOverrideWithRef(ref) {
    return function (override) {
        var overrideAs = override;
        return overrideAs.__systemRef === ref;
    };
}
/**
 * Guard functionality to check if an override rule is of type {@link SystemConfigOverrideRule}.
 * It will return true if the {@link SystemConfigOverrideRule} has any systemRef set.
 *
 * @internal
 */
export var isSystemOverride = function (override) {
    var _a;
    return typeof ((_a = override) === null || _a === void 0 ? void 0 : _a.__systemRef) === 'string';
};
export var FieldConfigProperty;
(function (FieldConfigProperty) {
    FieldConfigProperty["Unit"] = "unit";
    FieldConfigProperty["Min"] = "min";
    FieldConfigProperty["Max"] = "max";
    FieldConfigProperty["Decimals"] = "decimals";
    FieldConfigProperty["DisplayName"] = "displayName";
    FieldConfigProperty["NoValue"] = "noValue";
    FieldConfigProperty["Thresholds"] = "thresholds";
    FieldConfigProperty["Mappings"] = "mappings";
    FieldConfigProperty["Links"] = "links";
    FieldConfigProperty["Color"] = "color";
})(FieldConfigProperty || (FieldConfigProperty = {}));
//# sourceMappingURL=fieldOverrides.js.map