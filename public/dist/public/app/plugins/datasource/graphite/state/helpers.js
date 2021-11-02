import { __awaiter, __generator } from "tslib";
import { clone } from 'lodash';
import { dispatch } from '../../../../store/store';
import { notifyApp } from '../../../../core/reducers/appNotification';
import { createErrorNotification } from '../../../../core/copy/appNotification';
/**
 * Helpers used by reducers and providers. They modify state object directly so should operate on a copy of the state.
 */
export var GRAPHITE_TAG_OPERATORS = ['=', '!=', '=~', '!=~'];
/**
 * Tag names and metric names are displayed in a single dropdown. This prefix is used to
 * distinguish both in the UI.
 */
export var TAG_PREFIX = 'tag: ';
/**
 * Create new AST based on new query.
 * Build segments from parsed metric name and functions.
 */
export function parseTarget(state) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    state.queryModel.parseTarget();
                    return [4 /*yield*/, buildSegments(state)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * Create segments out of the current metric path + add "select metrics" if it's possible to add more to the path
 */
export function buildSegments(state, modifyLastSegment) {
    if (modifyLastSegment === void 0) { modifyLastSegment = true; }
    return __awaiter(this, void 0, void 0, function () {
        var checkOtherSegmentsIndex;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // Start with a shallow copy from the model, then check if "select metric" segment should be added at the end
                    state.segments = clone(state.queryModel.segments);
                    checkOtherSegmentsIndex = state.queryModel.checkOtherSegmentsIndex || 0;
                    return [4 /*yield*/, checkOtherSegments(state, checkOtherSegmentsIndex, modifyLastSegment)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * Add "select metric" segment at the end
 */
export function addSelectMetricSegment(state) {
    state.queryModel.addSelectMetricSegment();
    state.segments.push({ value: 'select metric', fake: true });
}
/**
 * Validates the state after adding or changing a segment:
 * - adds "select metric" only when more segments can be added to the metric name
 * - check if subsequent segments are still valid if in-between segment changes and
 *   removes invalid segments.
 */
export function checkOtherSegments(state, fromIndex, modifyLastSegment) {
    if (modifyLastSegment === void 0) { modifyLastSegment = true; }
    return __awaiter(this, void 0, void 0, function () {
        var path, segments, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (state.queryModel.segments.length === 1 && state.queryModel.segments[0].type === 'series-ref') {
                        return [2 /*return*/];
                    }
                    if (fromIndex === 0) {
                        addSelectMetricSegment(state);
                        return [2 /*return*/];
                    }
                    path = state.queryModel.getSegmentPathUpTo(fromIndex + 1);
                    if (path === '') {
                        return [2 /*return*/];
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 7, , 8]);
                    return [4 /*yield*/, state.datasource.metricFindQuery(path)];
                case 2:
                    segments = _a.sent();
                    if (!(segments.length === 0)) return [3 /*break*/, 3];
                    if (path !== '' && modifyLastSegment) {
                        state.queryModel.segments = state.queryModel.segments.splice(0, fromIndex);
                        state.segments = state.segments.splice(0, fromIndex);
                        addSelectMetricSegment(state);
                    }
                    return [3 /*break*/, 6];
                case 3:
                    if (!segments[0].expandable) return [3 /*break*/, 6];
                    if (!(state.segments.length === fromIndex)) return [3 /*break*/, 4];
                    addSelectMetricSegment(state);
                    return [3 /*break*/, 6];
                case 4: return [4 /*yield*/, checkOtherSegments(state, fromIndex + 1)];
                case 5:
                    _a.sent();
                    _a.label = 6;
                case 6: return [3 /*break*/, 8];
                case 7:
                    err_1 = _a.sent();
                    handleMetricsAutoCompleteError(state, err_1);
                    return [3 /*break*/, 8];
                case 8: return [2 /*return*/];
            }
        });
    });
}
export function spliceSegments(state, index) {
    state.segments = state.segments.splice(0, index);
    state.queryModel.segments = state.queryModel.segments.splice(0, index);
}
export function emptySegments(state) {
    state.queryModel.segments = [];
    state.segments = [];
}
/**
 * When seriesByTag function is added the UI changes it's state and only tags can be added from now.
 */
export function addSeriesByTagFunc(state, tag) {
    return __awaiter(this, void 0, void 0, function () {
        var newFunc, tagParam;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    newFunc = state.datasource.createFuncInstance('seriesByTag', {
                        withDefaultParams: false,
                    });
                    tagParam = tag + "=";
                    newFunc.params = [tagParam];
                    state.queryModel.addFunction(newFunc);
                    newFunc.added = true;
                    emptySegments(state);
                    handleTargetChanged(state);
                    return [4 /*yield*/, parseTarget(state)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
export function smartlyHandleNewAliasByNode(state, func) {
    if (func.def.name !== 'aliasByNode') {
        return;
    }
    for (var i = 0; i < state.segments.length; i++) {
        if (state.segments[i].value.indexOf('*') >= 0) {
            func.params[0] = i;
            func.added = false;
            handleTargetChanged(state);
            return;
        }
    }
}
/**
 * Pauses running the query to allow selecting tag value. This is to prevent getting errors if the query is run
 * for a tag with no selected value.
 */
export function pause(state) {
    state.paused = true;
}
export function removeTagPrefix(value) {
    return value.replace(TAG_PREFIX, '');
}
export function handleTargetChanged(state) {
    if (state.queryModel.error) {
        return;
    }
    var oldTarget = state.queryModel.target.target;
    // Interpolate from other queries:
    // Because of mixed data sources the list may contain queries for non-Graphite data sources. To ensure a valid query
    // is used for interpolation we should check required properties are passed though in theory it allows to interpolate
    // with queries that contain "target" property as well.
    state.queryModel.updateModelTarget((state.queries || []).filter(function (query) { return 'target' in query && typeof query.target === 'string'; }));
    if (state.queryModel.target.target !== oldTarget && !state.paused) {
        state.refresh(state.target.target);
    }
}
/**
 * When metrics autocomplete fails - the error is shown, but only once per page view
 */
export function handleMetricsAutoCompleteError(state, error) {
    console.error(error);
    if (!state.metricAutoCompleteErrorShown) {
        state.metricAutoCompleteErrorShown = true;
        dispatch(notifyApp(createErrorNotification("Fetching metrics failed: " + error.message + ".")));
    }
    return state;
}
/**
 * When tags autocomplete fails - the error is shown, but only once per page view
 */
export function handleTagsAutoCompleteError(state, error) {
    console.error(error);
    if (!state.tagsAutoCompleteErrorShown) {
        state.tagsAutoCompleteErrorShown = true;
        dispatch(notifyApp(createErrorNotification("Fetching tags failed: " + error.message + ".")));
    }
    return state;
}
//# sourceMappingURL=helpers.js.map