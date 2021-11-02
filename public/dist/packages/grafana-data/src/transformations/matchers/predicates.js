import { __values } from "tslib";
import { FieldType } from '../../types/dataFrame';
import { MatcherID } from './ids';
import { getFieldMatcher, fieldMatchers, getFrameMatchers, frameMatchers } from '../matchers';
var anyFieldMatcher = {
    id: MatcherID.anyMatch,
    name: 'Any',
    description: 'Any child matches (OR)',
    excludeFromPicker: true,
    defaultOptions: [],
    get: function (options) {
        var children = options.map(function (option) {
            return getFieldMatcher(option);
        });
        return function (field, frame, allFrames) {
            var e_1, _a;
            try {
                for (var children_1 = __values(children), children_1_1 = children_1.next(); !children_1_1.done; children_1_1 = children_1.next()) {
                    var child = children_1_1.value;
                    if (child(field, frame, allFrames)) {
                        return true;
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (children_1_1 && !children_1_1.done && (_a = children_1.return)) _a.call(children_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
            return false;
        };
    },
    getOptionsDisplayText: function (options) {
        var e_2, _a;
        var text = '';
        try {
            for (var options_1 = __values(options), options_1_1 = options_1.next(); !options_1_1.done; options_1_1 = options_1.next()) {
                var sub = options_1_1.value;
                if (text.length > 0) {
                    text += ' OR ';
                }
                var matcher = fieldMatchers.get(sub.id);
                text += matcher.getOptionsDisplayText ? matcher.getOptionsDisplayText(sub) : matcher.name;
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (options_1_1 && !options_1_1.done && (_a = options_1.return)) _a.call(options_1);
            }
            finally { if (e_2) throw e_2.error; }
        }
        return text;
    },
};
var anyFrameMatcher = {
    id: MatcherID.anyMatch,
    name: 'Any',
    description: 'Any child matches (OR)',
    excludeFromPicker: true,
    defaultOptions: [],
    get: function (options) {
        var children = options.map(function (option) {
            return getFrameMatchers(option);
        });
        return function (frame) {
            var e_3, _a;
            try {
                for (var children_2 = __values(children), children_2_1 = children_2.next(); !children_2_1.done; children_2_1 = children_2.next()) {
                    var child = children_2_1.value;
                    if (child(frame)) {
                        return true;
                    }
                }
            }
            catch (e_3_1) { e_3 = { error: e_3_1 }; }
            finally {
                try {
                    if (children_2_1 && !children_2_1.done && (_a = children_2.return)) _a.call(children_2);
                }
                finally { if (e_3) throw e_3.error; }
            }
            return false;
        };
    },
    getOptionsDisplayText: function (options) {
        var e_4, _a;
        var text = '';
        try {
            for (var options_2 = __values(options), options_2_1 = options_2.next(); !options_2_1.done; options_2_1 = options_2.next()) {
                var sub = options_2_1.value;
                if (text.length > 0) {
                    text += ' OR ';
                }
                var matcher = frameMatchers.get(sub.id);
                text += matcher.getOptionsDisplayText ? matcher.getOptionsDisplayText(sub) : matcher.name;
            }
        }
        catch (e_4_1) { e_4 = { error: e_4_1 }; }
        finally {
            try {
                if (options_2_1 && !options_2_1.done && (_a = options_2.return)) _a.call(options_2);
            }
            finally { if (e_4) throw e_4.error; }
        }
        return text;
    },
};
var allFieldsMatcher = {
    id: MatcherID.allMatch,
    name: 'All',
    description: 'Everything matches (AND)',
    excludeFromPicker: true,
    defaultOptions: [],
    get: function (options) {
        var children = options.map(function (option) {
            return getFieldMatcher(option);
        });
        return function (field, frame, allFrames) {
            var e_5, _a;
            try {
                for (var children_3 = __values(children), children_3_1 = children_3.next(); !children_3_1.done; children_3_1 = children_3.next()) {
                    var child = children_3_1.value;
                    if (!child(field, frame, allFrames)) {
                        return false;
                    }
                }
            }
            catch (e_5_1) { e_5 = { error: e_5_1 }; }
            finally {
                try {
                    if (children_3_1 && !children_3_1.done && (_a = children_3.return)) _a.call(children_3);
                }
                finally { if (e_5) throw e_5.error; }
            }
            return true;
        };
    },
    getOptionsDisplayText: function (options) {
        var e_6, _a;
        var text = '';
        try {
            for (var options_3 = __values(options), options_3_1 = options_3.next(); !options_3_1.done; options_3_1 = options_3.next()) {
                var sub = options_3_1.value;
                if (text.length > 0) {
                    text += ' AND ';
                }
                var matcher = fieldMatchers.get(sub.id); // Ugho what about frame
                text += matcher.getOptionsDisplayText ? matcher.getOptionsDisplayText(sub) : matcher.name;
            }
        }
        catch (e_6_1) { e_6 = { error: e_6_1 }; }
        finally {
            try {
                if (options_3_1 && !options_3_1.done && (_a = options_3.return)) _a.call(options_3);
            }
            finally { if (e_6) throw e_6.error; }
        }
        return text;
    },
};
var allFramesMatcher = {
    id: MatcherID.allMatch,
    name: 'All',
    description: 'Everything matches (AND)',
    excludeFromPicker: true,
    defaultOptions: [],
    get: function (options) {
        var children = options.map(function (option) {
            return getFrameMatchers(option);
        });
        return function (frame) {
            var e_7, _a;
            try {
                for (var children_4 = __values(children), children_4_1 = children_4.next(); !children_4_1.done; children_4_1 = children_4.next()) {
                    var child = children_4_1.value;
                    if (!child(frame)) {
                        return false;
                    }
                }
            }
            catch (e_7_1) { e_7 = { error: e_7_1 }; }
            finally {
                try {
                    if (children_4_1 && !children_4_1.done && (_a = children_4.return)) _a.call(children_4);
                }
                finally { if (e_7) throw e_7.error; }
            }
            return true;
        };
    },
    getOptionsDisplayText: function (options) {
        var e_8, _a;
        var text = '';
        try {
            for (var options_4 = __values(options), options_4_1 = options_4.next(); !options_4_1.done; options_4_1 = options_4.next()) {
                var sub = options_4_1.value;
                if (text.length > 0) {
                    text += ' AND ';
                }
                var matcher = frameMatchers.get(sub.id);
                text += matcher.getOptionsDisplayText ? matcher.getOptionsDisplayText(sub) : matcher.name;
            }
        }
        catch (e_8_1) { e_8 = { error: e_8_1 }; }
        finally {
            try {
                if (options_4_1 && !options_4_1.done && (_a = options_4.return)) _a.call(options_4);
            }
            finally { if (e_8) throw e_8.error; }
        }
        return text;
    },
};
var notFieldMatcher = {
    id: MatcherID.invertMatch,
    name: 'NOT',
    description: 'Inverts other matchers',
    excludeFromPicker: true,
    get: function (option) {
        var check = getFieldMatcher(option);
        return function (field, frame, allFrames) {
            return !check(field, frame, allFrames);
        };
    },
    getOptionsDisplayText: function (options) {
        var matcher = fieldMatchers.get(options.id);
        var text = matcher.getOptionsDisplayText ? matcher.getOptionsDisplayText(options.options) : matcher.name;
        return 'NOT ' + text;
    },
};
var notFrameMatcher = {
    id: MatcherID.invertMatch,
    name: 'NOT',
    description: 'Inverts other matchers',
    excludeFromPicker: true,
    get: function (option) {
        var check = getFrameMatchers(option);
        return function (frame) {
            return !check(frame);
        };
    },
    getOptionsDisplayText: function (options) {
        var matcher = frameMatchers.get(options.id);
        var text = matcher.getOptionsDisplayText ? matcher.getOptionsDisplayText(options.options) : matcher.name;
        return 'NOT ' + text;
    },
};
export var alwaysFieldMatcher = function (field) {
    return true;
};
export var alwaysFrameMatcher = function (frame) {
    return true;
};
export var neverFieldMatcher = function (field) {
    return false;
};
export var notTimeFieldMatcher = function (field) {
    return field.type !== FieldType.time;
};
export var neverFrameMatcher = function (frame) {
    return false;
};
var alwaysFieldMatcherInfo = {
    id: MatcherID.alwaysMatch,
    name: 'All Fields',
    description: 'Always Match',
    get: function (option) {
        return alwaysFieldMatcher;
    },
    getOptionsDisplayText: function (options) {
        return 'Always';
    },
};
var alwaysFrameMatcherInfo = {
    id: MatcherID.alwaysMatch,
    name: 'All Frames',
    description: 'Always Match',
    get: function (option) {
        return alwaysFrameMatcher;
    },
    getOptionsDisplayText: function (options) {
        return 'Always';
    },
};
var neverFieldMatcherInfo = {
    id: MatcherID.neverMatch,
    name: 'No Fields',
    description: 'Never Match',
    excludeFromPicker: true,
    get: function (option) {
        return neverFieldMatcher;
    },
    getOptionsDisplayText: function (options) {
        return 'Never';
    },
};
var neverFrameMatcherInfo = {
    id: MatcherID.neverMatch,
    name: 'No Frames',
    description: 'Never Match',
    get: function (option) {
        return neverFrameMatcher;
    },
    getOptionsDisplayText: function (options) {
        return 'Never';
    },
};
export function getFieldPredicateMatchers() {
    return [anyFieldMatcher, allFieldsMatcher, notFieldMatcher, alwaysFieldMatcherInfo, neverFieldMatcherInfo];
}
export function getFramePredicateMatchers() {
    return [anyFrameMatcher, allFramesMatcher, notFrameMatcher, alwaysFrameMatcherInfo, neverFrameMatcherInfo];
}
//# sourceMappingURL=predicates.js.map