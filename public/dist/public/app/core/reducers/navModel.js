import { __assign, __values } from "tslib";
import { createAction } from '@reduxjs/toolkit';
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
        for (var children_1 = __values(children), children_1_1 = children_1.next(); !children_1_1.done; children_1_1 = children_1.next()) {
            var node = children_1_1.value;
            navIndex[node.id] = __assign(__assign({}, node), { parentItem: parentItem });
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
    navIndex['not-found'] = __assign({}, buildWarningNav('Page not found', '404 Error').node);
}
function buildWarningNav(text, subTitle) {
    var node = {
        text: text,
        subTitle: subTitle,
        icon: 'exclamation-triangle',
    };
    return {
        breadcrumbs: [node],
        node: node,
        main: node,
    };
}
export var initialState = {};
export var updateNavIndex = createAction('navIndex/updateNavIndex');
// Since the configuration subtitle includes the organization name, we include this action to update the org name if it changes.
export var updateConfigurationSubtitle = createAction('navIndex/updateConfigurationSubtitle');
export var getItemWithNewSubTitle = function (item, subTitle) {
    var _a, _b;
    return (__assign(__assign({}, item), { parentItem: __assign(__assign({}, item.parentItem), { text: (_b = (_a = item.parentItem) === null || _a === void 0 ? void 0 : _a.text) !== null && _b !== void 0 ? _b : '', subTitle: subTitle }) }));
};
// Redux Toolkit uses ImmerJs as part of their solution to ensure that state objects are not mutated.
// ImmerJs has an autoFreeze option that freezes objects from change which means this reducer can't be migrated to createSlice
// because the state would become frozen and during run time we would get errors because Angular would try to mutate
// the frozen state.
// https://github.com/reduxjs/redux-toolkit/issues/242
export var navIndexReducer = function (state, action) {
    var e_2, _a;
    if (state === void 0) { state = initialState; }
    if (updateNavIndex.match(action)) {
        var newPages = {};
        var payload = action.payload;
        try {
            for (var _b = __values(payload.children), _c = _b.next(); !_c.done; _c = _b.next()) {
                var node = _c.value;
                newPages[node.id] = __assign(__assign({}, node), { parentItem: payload });
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_2) throw e_2.error; }
        }
        return __assign(__assign({}, state), newPages);
    }
    else if (updateConfigurationSubtitle.match(action)) {
        var subTitle = "Organization: " + action.payload;
        return __assign(__assign({}, state), { cfg: __assign(__assign({}, state.cfg), { subTitle: subTitle }), datasources: getItemWithNewSubTitle(state.datasources, subTitle), users: getItemWithNewSubTitle(state.users, subTitle), teams: getItemWithNewSubTitle(state.teams, subTitle), plugins: getItemWithNewSubTitle(state.plugins, subTitle), 'org-settings': getItemWithNewSubTitle(state['org-settings'], subTitle), apikeys: getItemWithNewSubTitle(state.apikeys, subTitle) });
    }
    return state;
};
//# sourceMappingURL=navModel.js.map