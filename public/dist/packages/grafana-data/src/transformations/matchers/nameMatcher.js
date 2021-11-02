import { FieldMatcherID, FrameMatcherID } from './ids';
import { stringToJsRegex } from '../../text/string';
import { getFieldDisplayName } from '../../field/fieldState';
/**
 * Mode to be able to toggle if the names matcher should match fields in provided
 * list or all except provided names.
 * @public
 */
export var ByNamesMatcherMode;
(function (ByNamesMatcherMode) {
    ByNamesMatcherMode["exclude"] = "exclude";
    ByNamesMatcherMode["include"] = "include";
})(ByNamesMatcherMode || (ByNamesMatcherMode = {}));
// General Field matcher
var fieldNameMatcher = {
    id: FieldMatcherID.byName,
    name: 'Field Name',
    description: 'match the field name',
    defaultOptions: '',
    get: function (name) {
        return function (field, frame, allFrames) {
            return name === field.name || getFieldDisplayName(field, frame, allFrames) === name;
        };
    },
    getOptionsDisplayText: function (name) {
        return "Field name: " + name;
    },
};
var multipleFieldNamesMatcher = {
    id: FieldMatcherID.byNames,
    name: 'Field Names',
    description: 'match any of the given the field names',
    defaultOptions: {
        mode: ByNamesMatcherMode.include,
        names: [],
    },
    get: function (options) {
        var names = options.names, _a = options.mode, mode = _a === void 0 ? ByNamesMatcherMode.include : _a;
        var uniqueNames = new Set(names !== null && names !== void 0 ? names : []);
        var matcher = function (field, frame, frames) {
            return uniqueNames.has(field.name) || uniqueNames.has(getFieldDisplayName(field, frame, frames));
        };
        if (mode === ByNamesMatcherMode.exclude) {
            return function (field, frame, frames) {
                return !matcher(field, frame, frames);
            };
        }
        return matcher;
    },
    getOptionsDisplayText: function (options) {
        var names = options.names, mode = options.mode;
        var displayText = (names !== null && names !== void 0 ? names : []).join(', ');
        if (mode === ByNamesMatcherMode.exclude) {
            return "All except: " + displayText;
        }
        return "All of: " + displayText;
    },
};
var regexpFieldNameMatcher = {
    id: FieldMatcherID.byRegexp,
    name: 'Field Name by Regexp',
    description: 'match the field name by a given regexp pattern',
    defaultOptions: '/.*/',
    get: function (pattern) {
        var regexp = patternToRegex(pattern);
        return function (field, frame, allFrames) {
            var displayName = getFieldDisplayName(field, frame, allFrames);
            return !!regexp && regexp.test(displayName);
        };
    },
    getOptionsDisplayText: function (pattern) {
        return "Field name by pattern: " + pattern;
    },
};
/**
 * Field matcher that will match all fields that exists in a
 * data frame with configured refId.
 * @public
 */
var fieldsInFrameMatcher = {
    id: FieldMatcherID.byFrameRefID,
    name: 'Fields by frame refId',
    description: 'match all fields returned in data frame with refId.',
    defaultOptions: '',
    get: function (refId) {
        return function (field, frame, allFrames) {
            return frame.refId === refId;
        };
    },
    getOptionsDisplayText: function (refId) {
        return "Math all fields returned by query with reference ID: " + refId;
    },
};
var regexpOrMultipleNamesMatcher = {
    id: FieldMatcherID.byRegexpOrNames,
    name: 'Field Name by Regexp or Names',
    description: 'match the field name by a given regexp pattern or given names',
    defaultOptions: {
        pattern: '/.*/',
        names: [],
    },
    get: function (options) {
        var _a;
        var regexpMatcher = regexpFieldNameMatcher.get((options === null || options === void 0 ? void 0 : options.pattern) || '');
        var namesMatcher = multipleFieldNamesMatcher.get({
            mode: ByNamesMatcherMode.include,
            names: (_a = options === null || options === void 0 ? void 0 : options.names) !== null && _a !== void 0 ? _a : [],
        });
        return function (field, frame, allFrames) {
            return namesMatcher(field, frame, allFrames) || regexpMatcher(field, frame, allFrames);
        };
    },
    getOptionsDisplayText: function (options) {
        var _a, _b, _c;
        var pattern = (_a = options === null || options === void 0 ? void 0 : options.pattern) !== null && _a !== void 0 ? _a : '';
        var names = (_c = (_b = options === null || options === void 0 ? void 0 : options.names) === null || _b === void 0 ? void 0 : _b.join(',')) !== null && _c !== void 0 ? _c : '';
        return "Field name by pattern: " + pattern + " or names: " + names;
    },
};
var patternToRegex = function (pattern) {
    if (!pattern) {
        return undefined;
    }
    try {
        return stringToJsRegex(pattern);
    }
    catch (error) {
        console.error(error);
        return undefined;
    }
};
// General Frame matcher
var frameNameMatcher = {
    id: FrameMatcherID.byName,
    name: 'Frame Name',
    description: 'match the frame name',
    defaultOptions: '/.*/',
    get: function (pattern) {
        var regex = stringToJsRegex(pattern);
        return function (frame) {
            return regex.test(frame.name || '');
        };
    },
    getOptionsDisplayText: function (pattern) {
        return "Frame name: " + pattern;
    },
};
/**
 * Registry Initialization
 */
export function getFieldNameMatchers() {
    return [
        fieldNameMatcher,
        regexpFieldNameMatcher,
        multipleFieldNamesMatcher,
        regexpOrMultipleNamesMatcher,
        fieldsInFrameMatcher,
    ];
}
export function getFrameNameMatchers() {
    return [frameNameMatcher];
}
//# sourceMappingURL=nameMatcher.js.map