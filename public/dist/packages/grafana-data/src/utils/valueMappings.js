import { __assign, __values } from "tslib";
import { MappingType, SpecialValueMatch } from '../types';
import { getActiveThreshold } from '../field';
import { stringToJsRegex } from '../text/string';
export function getValueMappingResult(valueMappings, value) {
    var e_1, _a;
    try {
        for (var valueMappings_1 = __values(valueMappings), valueMappings_1_1 = valueMappings_1.next(); !valueMappings_1_1.done; valueMappings_1_1 = valueMappings_1.next()) {
            var vm = valueMappings_1_1.value;
            switch (vm.type) {
                case MappingType.ValueToText:
                    if (value == null) {
                        continue;
                    }
                    var result = vm.options[value];
                    if (result) {
                        return result;
                    }
                    break;
                case MappingType.RangeToText:
                    if (value == null) {
                        continue;
                    }
                    var valueAsNumber = parseFloat(value);
                    if (isNaN(valueAsNumber)) {
                        continue;
                    }
                    var isNumFrom = !isNaN(vm.options.from);
                    if (isNumFrom && valueAsNumber < vm.options.from) {
                        continue;
                    }
                    var isNumTo = !isNaN(vm.options.to);
                    if (isNumTo && valueAsNumber > vm.options.to) {
                        continue;
                    }
                    return vm.options.result;
                case MappingType.RegexToText:
                    if (value == null) {
                        console.log('null value');
                        continue;
                    }
                    if (typeof value !== 'string') {
                        console.log('non-string value', typeof value);
                        continue;
                    }
                    var regex = stringToJsRegex(vm.options.pattern);
                    var thisResult = Object.create(vm.options.result);
                    thisResult.text = value.replace(regex, vm.options.result.text || '');
                    return thisResult;
                case MappingType.SpecialValue:
                    switch (vm.options.match) {
                        case SpecialValueMatch.Null: {
                            if (value == null) {
                                return vm.options.result;
                            }
                            break;
                        }
                        case SpecialValueMatch.NaN: {
                            if (isNaN(value)) {
                                return vm.options.result;
                            }
                            break;
                        }
                        case SpecialValueMatch.NullAndNaN: {
                            if (isNaN(value) || value == null) {
                                return vm.options.result;
                            }
                            break;
                        }
                        case SpecialValueMatch.True: {
                            if (value === true || value === 'true') {
                                return vm.options.result;
                            }
                            break;
                        }
                        case SpecialValueMatch.False: {
                            if (value === false || value === 'false') {
                                return vm.options.result;
                            }
                            break;
                        }
                        case SpecialValueMatch.Empty: {
                            if (value === '') {
                                return vm.options.result;
                            }
                            break;
                        }
                    }
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (valueMappings_1_1 && !valueMappings_1_1.done && (_a = valueMappings_1.return)) _a.call(valueMappings_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return null;
}
// Ref https://stackoverflow.com/a/58550111
export function isNumeric(num) {
    return (typeof num === 'number' || (typeof num === 'string' && num.trim() !== '')) && !isNaN(num);
}
/**
 * @deprecated use MappingType instead
 * @internal
 */
export var LegacyMappingType;
(function (LegacyMappingType) {
    LegacyMappingType[LegacyMappingType["ValueToText"] = 1] = "ValueToText";
    LegacyMappingType[LegacyMappingType["RangeToText"] = 2] = "RangeToText";
})(LegacyMappingType || (LegacyMappingType = {}));
/**
 * @deprecated use getValueMappingResult instead
 * @internal
 */
export function getMappedValue(valueMappings, value) {
    var e_2, _a;
    var _b, _c;
    var emptyResult = { type: LegacyMappingType.ValueToText, value: '', text: '', from: '', to: '', id: 0 };
    if (!(valueMappings === null || valueMappings === void 0 ? void 0 : valueMappings.length)) {
        return emptyResult;
    }
    var upgraded = [];
    try {
        for (var valueMappings_2 = __values(valueMappings), valueMappings_2_1 = valueMappings_2.next(); !valueMappings_2_1.done; valueMappings_2_1 = valueMappings_2.next()) {
            var vm = valueMappings_2_1.value;
            if (isValueMapping(vm)) {
                upgraded.push(vm);
                continue;
            }
            upgraded.push(upgradeOldAngularValueMapping(vm));
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (valueMappings_2_1 && !valueMappings_2_1.done && (_a = valueMappings_2.return)) _a.call(valueMappings_2);
        }
        finally { if (e_2) throw e_2.error; }
    }
    if (!(upgraded === null || upgraded === void 0 ? void 0 : upgraded.length)) {
        return emptyResult;
    }
    var result = getValueMappingResult(upgraded, value);
    if (!result) {
        return emptyResult;
    }
    return {
        type: LegacyMappingType.ValueToText,
        value: result.text,
        text: (_b = result.text) !== null && _b !== void 0 ? _b : '',
        from: '',
        to: '',
        id: (_c = result.index) !== null && _c !== void 0 ? _c : 0,
    };
}
/**
 * @alpha
 * Converts the old Angular value mappings to new react style
 */
export function convertOldAngularValueMappings(panel, migratedThresholds) {
    var _a, _b, _c, _d;
    var mappings = [];
    // Guess the right type based on options
    var mappingType = panel.mappingType;
    if (!panel.mappingType) {
        if (panel.valueMaps && panel.valueMaps.length) {
            mappingType = 1;
        }
        else if (panel.rangeMaps && panel.rangeMaps.length) {
            mappingType = 2;
        }
    }
    if (mappingType === 1) {
        for (var i = 0; i < panel.valueMaps.length; i++) {
            var map = panel.valueMaps[i];
            mappings.push(upgradeOldAngularValueMapping(__assign(__assign({}, map), { id: i, type: MappingType.ValueToText }), ((_b = (_a = panel.fieldConfig) === null || _a === void 0 ? void 0 : _a.defaults) === null || _b === void 0 ? void 0 : _b.thresholds) || migratedThresholds));
        }
    }
    else if (mappingType === 2) {
        for (var i = 0; i < panel.rangeMaps.length; i++) {
            var map = panel.rangeMaps[i];
            mappings.push(upgradeOldAngularValueMapping(__assign(__assign({}, map), { id: i, type: MappingType.RangeToText }), ((_d = (_c = panel.fieldConfig) === null || _c === void 0 ? void 0 : _c.defaults) === null || _d === void 0 ? void 0 : _d.thresholds) || migratedThresholds));
        }
    }
    return mappings;
}
function upgradeOldAngularValueMapping(old, thresholds) {
    var valueMaps = { type: MappingType.ValueToText, options: {} };
    var newMappings = [];
    // Use the color we would have picked from thesholds
    var color = undefined;
    var numeric = parseFloat(old.text);
    if (thresholds && !isNaN(numeric)) {
        var level = getActiveThreshold(numeric, thresholds.steps);
        if (level && level.color) {
            color = level.color;
        }
    }
    switch (old.type) {
        case LegacyMappingType.ValueToText:
        case MappingType.ValueToText:
            if (old.value != null) {
                if (old.value === 'null') {
                    newMappings.push({
                        type: MappingType.SpecialValue,
                        options: {
                            match: SpecialValueMatch.Null,
                            result: { text: old.text, color: color },
                        },
                    });
                }
                else {
                    valueMaps.options[String(old.value)] = {
                        text: old.text,
                        color: color,
                    };
                }
            }
            break;
        case LegacyMappingType.RangeToText:
        case MappingType.RangeToText:
            if (old.from === 'null' || old.to === 'null') {
                newMappings.push({
                    type: MappingType.SpecialValue,
                    options: {
                        match: SpecialValueMatch.Null,
                        result: { text: old.text, color: color },
                    },
                });
            }
            else {
                newMappings.push({
                    type: MappingType.RangeToText,
                    options: {
                        from: +old.from,
                        to: +old.to,
                        result: { text: old.text, color: color },
                    },
                });
            }
            break;
    }
    if (Object.keys(valueMaps.options).length > 0) {
        newMappings.unshift(valueMaps);
    }
    return newMappings[0];
}
function isValueMapping(map) {
    if (!map) {
        return false;
    }
    return map.hasOwnProperty('options') && typeof map.options === 'object';
}
//# sourceMappingURL=valueMappings.js.map