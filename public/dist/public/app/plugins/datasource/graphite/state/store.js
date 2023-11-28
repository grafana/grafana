import { __awaiter } from "tslib";
import { getTemplateSrv } from '@grafana/runtime';
import GraphiteQuery from '../graphite_query';
import { actions } from './actions';
import { addSeriesByTagFunc, buildSegments, checkOtherSegments, emptySegments, handleTargetChanged, parseTarget, pause, removeTagPrefix, smartlyHandleNewAliasByNode, spliceSegments, } from './helpers';
const reducer = (action, state) => __awaiter(void 0, void 0, void 0, function* () {
    state = Object.assign({}, state);
    if (actions.init.match(action)) {
        const deps = action.payload;
        deps.target.target = deps.target.target || '';
        yield deps.datasource.waitForFuncDefsLoaded();
        state = Object.assign(Object.assign(Object.assign({}, state), deps), { queryModel: new GraphiteQuery(deps.datasource, deps.target, getTemplateSrv()), supportsTags: deps.datasource.supportsTags, paused: false, removeTagValue: '-- remove tag --', funcDefs: deps.datasource.funcDefs, queries: deps.queries });
        yield buildSegments(state, false);
    }
    if (actions.timeRangeChanged.match(action)) {
        state.range = action.payload;
    }
    if (actions.queriesChanged.match(action)) {
        state.queries = action.payload;
        handleTargetChanged(state);
    }
    if (actions.queryChanged.match(action)) {
        state.target.target = action.payload.target || '';
        yield parseTarget(state);
        handleTargetChanged(state);
    }
    if (actions.segmentValueChanged.match(action)) {
        const { segment: segmentOrString, index: segmentIndex } = action.payload;
        let segment;
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
        if (segment.type === 'tag') {
            const tag = removeTagPrefix(segment.value);
            pause(state);
            yield addSeriesByTagFunc(state, tag);
            return state;
        }
        // if newly selected segment can be expanded -> check if the path is correct
        if (segment.expandable) {
            yield checkOtherSegments(state, segmentIndex + 1);
        }
        else {
            // if not expandable -> remove all other segments
            spliceSegments(state, segmentIndex + 1);
        }
        handleTargetChanged(state);
    }
    if (actions.tagChanged.match(action)) {
        const { tag, index: tagIndex } = action.payload;
        state.queryModel.updateTag(tag, tagIndex);
        handleTargetChanged(state);
        if (state.queryModel.tags.length === 0) {
            yield checkOtherSegments(state, 0);
            state.paused = false;
        }
    }
    if (actions.addNewTag.match(action)) {
        const segment = action.payload.segment;
        const newTagKey = segment.value;
        const newTag = { key: newTagKey, operator: '=', value: '' };
        state.queryModel.addTag(newTag);
        handleTargetChanged(state);
    }
    if (actions.unpause.match(action)) {
        state.paused = false;
        state.refresh();
    }
    if (actions.addFunction.match(action)) {
        const newFunc = state.datasource.createFuncInstance(action.payload.name, {
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
        if (newFunc.def.name === 'seriesByTag') {
            yield parseTarget(state);
        }
    }
    if (actions.removeFunction.match(action)) {
        state.queryModel.removeFunction(action.payload.func);
        handleTargetChanged(state);
    }
    if (actions.moveFunction.match(action)) {
        const { func, offset } = action.payload;
        state.queryModel.moveFunction(func, offset);
        handleTargetChanged(state);
    }
    if (actions.updateFunctionParam.match(action)) {
        const { func, index, value } = action.payload;
        func.updateParam(value, index);
        handleTargetChanged(state);
    }
    if (actions.updateQuery.match(action)) {
        state.target.target = action.payload.query;
        handleTargetChanged(state);
    }
    if (actions.runQuery.match(action)) {
        state.refresh();
    }
    if (actions.toggleEditorMode.match(action)) {
        state.target.textEditor = !state.target.textEditor;
        yield parseTarget(state);
    }
    return Object.assign({}, state);
});
export const createStore = (onChange) => {
    let state = {};
    const dispatch = (action) => __awaiter(void 0, void 0, void 0, function* () {
        state = yield reducer(action, state);
        onChange(state);
    });
    return dispatch;
};
//# sourceMappingURL=store.js.map