import * as tslib_1 from "tslib";
import { ActionTypes } from 'app/core/actions/navModel';
import config from 'app/core/config';
export function buildInitialState() {
    var navIndex = {};
    var rootNodes = config.bootData.navTree;
    buildNavIndex(navIndex, rootNodes);
    return navIndex;
}
function buildNavIndex(navIndex, children, parentItem) {
    var e_1, _a;
    try {
        for (var children_1 = tslib_1.__values(children), children_1_1 = children_1.next(); !children_1_1.done; children_1_1 = children_1.next()) {
            var node = children_1_1.value;
            navIndex[node.id] = tslib_1.__assign({}, node, { parentItem: parentItem });
            if (node.children) {
                buildNavIndex(navIndex, node.children, node);
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
}
export var initialState = buildInitialState();
export var navIndexReducer = function (state, action) {
    if (state === void 0) { state = initialState; }
    var e_2, _a;
    switch (action.type) {
        case ActionTypes.UpdateNavIndex:
            var newPages = {};
            var payload = action.payload;
            try {
                for (var _b = tslib_1.__values(payload.children), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var node = _c.value;
                    newPages[node.id] = tslib_1.__assign({}, node, { parentItem: payload });
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_2) throw e_2.error; }
            }
            return tslib_1.__assign({}, state, newPages);
    }
    return state;
};
//# sourceMappingURL=navModel.js.map