import { __awaiter, __generator, __read, __spreadArray } from "tslib";
import { eachRight, map, remove } from 'lodash';
import { TAG_PREFIX, GRAPHITE_TAG_OPERATORS, handleMetricsAutoCompleteError, handleTagsAutoCompleteError, } from './helpers';
import { mapSegmentsToSelectables, mapStringsToSelectables } from '../components/helpers';
/**
 * Providers are hooks for views to provide temporal data for autocomplete. They don't modify the state.
 */
/**
 * Return list of available options for a segment with given index
 *
 * It may be:
 * - mixed list of metrics and tags (only when nothing was selected)
 * - list of metric names (if a metric name was selected for this segment)
 */
function getAltSegments(state, index, prefix) {
    return __awaiter(this, void 0, void 0, function () {
        var query, options, segments, altSegments_1, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    query = prefix.length > 0 ? '*' + prefix + '*' : '*';
                    if (index > 0) {
                        query = state.queryModel.getSegmentPathUpTo(index) + '.' + query;
                    }
                    options = {
                        range: state.range,
                        requestId: 'get-alt-segments',
                    };
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 6, , 7]);
                    return [4 /*yield*/, state.datasource.metricFindQuery(query, options)];
                case 2:
                    segments = _a.sent();
                    altSegments_1 = map(segments, function (segment) {
                        return {
                            value: segment.text,
                            expandable: segment.expandable,
                        };
                    });
                    if (index > 0 && altSegments_1.length === 0) {
                        return [2 /*return*/, altSegments_1];
                    }
                    // add query references
                    if (index === 0) {
                        eachRight(state.queries, function (target) {
                            if (target.refId === state.queryModel.target.refId) {
                                return;
                            }
                            altSegments_1.unshift({
                                type: 'series-ref',
                                value: '#' + target.refId,
                                expandable: false,
                            });
                        });
                    }
                    // add template variables
                    eachRight(state.templateSrv.getVariables(), function (variable) {
                        altSegments_1.unshift({
                            type: 'template',
                            value: '$' + variable.name,
                            expandable: true,
                        });
                    });
                    // add wildcard option
                    altSegments_1.unshift({ value: '*', expandable: true });
                    if (!(state.supportsTags && index === 0)) return [3 /*break*/, 4];
                    removeTaggedEntry(altSegments_1);
                    return [4 /*yield*/, addAltTagSegments(state, prefix, altSegments_1)];
                case 3: return [2 /*return*/, _a.sent()];
                case 4: return [2 /*return*/, altSegments_1];
                case 5: return [3 /*break*/, 7];
                case 6:
                    err_1 = _a.sent();
                    handleMetricsAutoCompleteError(state, err_1);
                    return [3 /*break*/, 7];
                case 7: return [2 /*return*/, []];
            }
        });
    });
}
export function getAltSegmentsSelectables(state, index, prefix) {
    return __awaiter(this, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = mapSegmentsToSelectables;
                    return [4 /*yield*/, getAltSegments(state, index, prefix)];
                case 1: return [2 /*return*/, _a.apply(void 0, [_b.sent()])];
            }
        });
    });
}
export function getTagOperatorsSelectables() {
    return mapStringsToSelectables(GRAPHITE_TAG_OPERATORS);
}
/**
 * Returns tags as dropdown options
 */
function getTags(state, index, tagPrefix) {
    return __awaiter(this, void 0, void 0, function () {
        var tagExpressions, values, altTags, err_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    tagExpressions = state.queryModel.renderTagExpressions(index);
                    return [4 /*yield*/, state.datasource.getTagsAutoComplete(tagExpressions, tagPrefix)];
                case 1:
                    values = _a.sent();
                    altTags = map(values, 'text');
                    altTags.splice(0, 0, state.removeTagValue);
                    return [2 /*return*/, altTags];
                case 2:
                    err_2 = _a.sent();
                    handleTagsAutoCompleteError(state, err_2);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/, []];
            }
        });
    });
}
export function getTagsSelectables(state, index, tagPrefix) {
    return __awaiter(this, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = mapStringsToSelectables;
                    return [4 /*yield*/, getTags(state, index, tagPrefix)];
                case 1: return [2 /*return*/, _a.apply(void 0, [_b.sent()])];
            }
        });
    });
}
/**
 * List of tags when a tag is added. getTags is used for editing.
 * When adding - segment is used. When editing - dropdown is used.
 */
function getTagsAsSegments(state, tagPrefix) {
    return __awaiter(this, void 0, void 0, function () {
        var tagsAsSegments, tagExpressions, values, err_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    tagExpressions = state.queryModel.renderTagExpressions();
                    return [4 /*yield*/, state.datasource.getTagsAutoComplete(tagExpressions, tagPrefix)];
                case 1:
                    values = _a.sent();
                    tagsAsSegments = map(values, function (val) {
                        return {
                            value: val.text,
                            type: 'tag',
                            expandable: false,
                        };
                    });
                    return [3 /*break*/, 3];
                case 2:
                    err_3 = _a.sent();
                    tagsAsSegments = [];
                    handleTagsAutoCompleteError(state, err_3);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/, tagsAsSegments];
            }
        });
    });
}
export function getTagsAsSegmentsSelectables(state, tagPrefix) {
    return __awaiter(this, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = mapSegmentsToSelectables;
                    return [4 /*yield*/, getTagsAsSegments(state, tagPrefix)];
                case 1: return [2 /*return*/, _a.apply(void 0, [_b.sent()])];
            }
        });
    });
}
function getTagValues(state, tag, index, valuePrefix) {
    return __awaiter(this, void 0, void 0, function () {
        var tagExpressions, tagKey, values, altValues;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    tagExpressions = state.queryModel.renderTagExpressions(index);
                    tagKey = tag.key;
                    return [4 /*yield*/, state.datasource.getTagValuesAutoComplete(tagExpressions, tagKey, valuePrefix, {})];
                case 1:
                    values = _a.sent();
                    altValues = map(values, 'text');
                    // Add template variables as additional values
                    eachRight(state.templateSrv.getVariables(), function (variable) {
                        altValues.push('${' + variable.name + ':regex}');
                    });
                    return [2 /*return*/, altValues];
            }
        });
    });
}
export function getTagValuesSelectables(state, tag, index, valuePrefix) {
    return __awaiter(this, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = mapStringsToSelectables;
                    return [4 /*yield*/, getTagValues(state, tag, index, valuePrefix)];
                case 1: return [2 /*return*/, _a.apply(void 0, [_b.sent()])];
            }
        });
    });
}
/**
 * Add segments with tags prefixed with "tag: " to include them in the same list as metrics
 */
function addAltTagSegments(state, prefix, altSegments) {
    return __awaiter(this, void 0, void 0, function () {
        var tagSegments;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getTagsAsSegments(state, prefix)];
                case 1:
                    tagSegments = _a.sent();
                    tagSegments = map(tagSegments, function (segment) {
                        segment.value = TAG_PREFIX + segment.value;
                        return segment;
                    });
                    return [2 /*return*/, altSegments.concat.apply(altSegments, __spreadArray([], __read(tagSegments), false))];
            }
        });
    });
}
function removeTaggedEntry(altSegments) {
    remove(altSegments, function (s) { return s.value === '_tagged'; });
}
//# sourceMappingURL=providers.js.map