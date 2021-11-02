import { __assign, __awaiter, __generator } from "tslib";
import GraphiteQuery from '../graphite_query';
import { actions } from './actions';
import { getTemplateSrv } from '@grafana/runtime';
import { addSeriesByTagFunc, buildSegments, checkOtherSegments, emptySegments, handleTargetChanged, parseTarget, pause, removeTagPrefix, smartlyHandleNewAliasByNode, spliceSegments, } from './helpers';
var reducer = function (action, state) { return __awaiter(void 0, void 0, void 0, function () {
    var deps, _a, segmentOrString, segmentIndex, segment, tag, _b, tag, tagIndex, segment, newTagKey, newTag, newFunc, _c, func, offset, _d, func, index, value;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                state = __assign({}, state);
                if (!actions.init.match(action)) return [3 /*break*/, 3];
                deps = action.payload;
                deps.target.target = deps.target.target || '';
                return [4 /*yield*/, deps.datasource.waitForFuncDefsLoaded()];
            case 1:
                _e.sent();
                state = __assign(__assign(__assign({}, state), deps), { queryModel: new GraphiteQuery(deps.datasource, deps.target, getTemplateSrv()), supportsTags: deps.datasource.supportsTags, paused: false, removeTagValue: '-- remove tag --', funcDefs: deps.datasource.funcDefs, queries: deps.queries });
                return [4 /*yield*/, buildSegments(state, false)];
            case 2:
                _e.sent();
                _e.label = 3;
            case 3:
                if (actions.timeRangeChanged.match(action)) {
                    state.range = action.payload;
                }
                if (actions.queriesChanged.match(action)) {
                    state.queries = action.payload;
                    handleTargetChanged(state);
                }
                if (!actions.queryChanged.match(action)) return [3 /*break*/, 5];
                state.target.target = action.payload.target || '';
                return [4 /*yield*/, parseTarget(state)];
            case 4:
                _e.sent();
                handleTargetChanged(state);
                _e.label = 5;
            case 5:
                if (!actions.segmentValueChanged.match(action)) return [3 /*break*/, 11];
                _a = action.payload, segmentOrString = _a.segment, segmentIndex = _a.index;
                segment = void 0;
                // is segment was changed to a string - create a new segment
                if (typeof segmentOrString === 'string') {
                    segment = {
                        value: segmentOrString,
                        expandable: true,
                        fake: false,
                    };
                }
                else {
                    segment = segmentOrString;
                }
                state.error = null;
                state.segments[segmentIndex] = segment;
                state.queryModel.updateSegmentValue(segment, segmentIndex);
                if (state.queryModel.functions.length > 0 && state.queryModel.functions[0].def.fake) {
                    state.queryModel.functions = [];
                }
                if (!(segment.type === 'tag')) return [3 /*break*/, 7];
                tag = removeTagPrefix(segment.value);
                pause(state);
                return [4 /*yield*/, addSeriesByTagFunc(state, tag)];
            case 6:
                _e.sent();
                return [2 /*return*/, state];
            case 7:
                if (!segment.expandable) return [3 /*break*/, 9];
                return [4 /*yield*/, checkOtherSegments(state, segmentIndex + 1)];
            case 8:
                _e.sent();
                return [3 /*break*/, 10];
            case 9:
                // if not expandable -> remove all other segments
                spliceSegments(state, segmentIndex + 1);
                _e.label = 10;
            case 10:
                handleTargetChanged(state);
                _e.label = 11;
            case 11:
                if (!actions.tagChanged.match(action)) return [3 /*break*/, 13];
                _b = action.payload, tag = _b.tag, tagIndex = _b.index;
                state.queryModel.updateTag(tag, tagIndex);
                handleTargetChanged(state);
                if (!(state.queryModel.tags.length === 0)) return [3 /*break*/, 13];
                return [4 /*yield*/, checkOtherSegments(state, 0)];
            case 12:
                _e.sent();
                state.paused = false;
                _e.label = 13;
            case 13:
                if (actions.addNewTag.match(action)) {
                    segment = action.payload.segment;
                    newTagKey = segment.value;
                    newTag = { key: newTagKey, operator: '=', value: '' };
                    state.queryModel.addTag(newTag);
                    handleTargetChanged(state);
                }
                if (actions.unpause.match(action)) {
                    state.paused = false;
                    state.refresh(state.target.target);
                }
                if (!actions.addFunction.match(action)) return [3 /*break*/, 15];
                newFunc = state.datasource.createFuncInstance(action.payload.name, {
                    withDefaultParams: true,
                });
                newFunc.added = true;
                state.queryModel.addFunction(newFunc);
                smartlyHandleNewAliasByNode(state, newFunc);
                if (state.segments.length === 1 && state.segments[0].fake) {
                    emptySegments(state);
                }
                if (!newFunc.params.length && newFunc.added) {
                    handleTargetChanged(state);
                }
                if (!(newFunc.def.name === 'seriesByTag')) return [3 /*break*/, 15];
                return [4 /*yield*/, parseTarget(state)];
            case 14:
                _e.sent();
                _e.label = 15;
            case 15:
                if (actions.removeFunction.match(action)) {
                    state.queryModel.removeFunction(action.payload.func);
                    handleTargetChanged(state);
                }
                if (actions.moveFunction.match(action)) {
                    _c = action.payload, func = _c.func, offset = _c.offset;
                    state.queryModel.moveFunction(func, offset);
                    handleTargetChanged(state);
                }
                if (actions.updateFunctionParam.match(action)) {
                    _d = action.payload, func = _d.func, index = _d.index, value = _d.value;
                    func.updateParam(value, index);
                    handleTargetChanged(state);
                }
                if (actions.updateQuery.match(action)) {
                    state.target.target = action.payload.query;
                    handleTargetChanged(state);
                }
                if (actions.runQuery.match(action)) {
                    state.refresh(state.target.target);
                }
                if (!actions.toggleEditorMode.match(action)) return [3 /*break*/, 17];
                state.target.textEditor = !state.target.textEditor;
                return [4 /*yield*/, parseTarget(state)];
            case 16:
                _e.sent();
                _e.label = 17;
            case 17: return [2 /*return*/, __assign({}, state)];
        }
    });
}); };
export var createStore = function (onChange) {
    var state = {};
    var dispatch = function (action) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, reducer(action, state)];
                case 1:
                    state = _a.sent();
                    onChange(state);
                    return [2 /*return*/];
            }
        });
    }); };
    return dispatch;
};
//# sourceMappingURL=store.js.map