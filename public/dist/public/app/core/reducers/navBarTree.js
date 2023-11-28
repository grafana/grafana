var _a, _b;
import { createSlice } from '@reduxjs/toolkit';
import { config } from '@grafana/runtime';
import { getNavSubTitle, getNavTitle } from '../utils/navBarItem-translations';
export const initialState = (_b = (_a = config.bootData) === null || _a === void 0 ? void 0 : _a.navTree) !== null && _b !== void 0 ? _b : [];
function translateNav(navTree) {
    return navTree.map((navItem) => {
        var _a, _b;
        const children = navItem.children && translateNav(navItem.children);
        return Object.assign(Object.assign({}, navItem), { children: children, text: (_a = getNavTitle(navItem.id)) !== null && _a !== void 0 ? _a : navItem.text, subTitle: (_b = getNavSubTitle(navItem.id)) !== null && _b !== void 0 ? _b : navItem.subTitle, emptyMessage: getNavTitle(navItem.emptyMessageId) });
    });
}
// this matches the prefix set in the backend navtree
export const ID_PREFIX = 'starred/';
const navTreeSlice = createSlice({
    name: 'navBarTree',
    initialState: () => { var _a, _b; return translateNav((_b = (_a = config.bootData) === null || _a === void 0 ? void 0 : _a.navTree) !== null && _b !== void 0 ? _b : []); },
    reducers: {
        setStarred: (state, action) => {
            var _a, _b, _c;
            const starredItems = state.find((navItem) => navItem.id === 'starred');
            const { id, title, url, isStarred } = action.payload;
            if (starredItems) {
                if (isStarred) {
                    if (!starredItems.children) {
                        starredItems.children = [];
                    }
                    const newStarredItem = {
                        id: ID_PREFIX + id,
                        text: title,
                        url,
                    };
                    starredItems.children.push(newStarredItem);
                    starredItems.children.sort((a, b) => a.text.localeCompare(b.text));
                }
                else {
                    const index = (_b = (_a = starredItems.children) === null || _a === void 0 ? void 0 : _a.findIndex((item) => item.id === ID_PREFIX + id)) !== null && _b !== void 0 ? _b : -1;
                    if (index > -1) {
                        (_c = starredItems === null || starredItems === void 0 ? void 0 : starredItems.children) === null || _c === void 0 ? void 0 : _c.splice(index, 1);
                    }
                }
            }
        },
        updateDashboardName: (state, action) => {
            var _a, _b;
            const { id, title, url } = action.payload;
            const starredItems = state.find((navItem) => navItem.id === 'starred');
            if (starredItems) {
                const navItem = (_a = starredItems.children) === null || _a === void 0 ? void 0 : _a.find((navItem) => navItem.id === id);
                if (navItem) {
                    navItem.text = title;
                    navItem.url = url;
                    (_b = starredItems.children) === null || _b === void 0 ? void 0 : _b.sort((a, b) => a.text.localeCompare(b.text));
                }
            }
        },
        removePluginFromNavTree: (state, action) => {
            const navID = 'plugin-page-' + action.payload.pluginID;
            const pluginItemIndex = state.findIndex((navItem) => navItem.id === navID);
            if (pluginItemIndex > -1) {
                state.splice(pluginItemIndex, 1);
            }
        },
    },
});
export const { setStarred, removePluginFromNavTree, updateDashboardName } = navTreeSlice.actions;
export const navTreeReducer = navTreeSlice.reducer;
//# sourceMappingURL=navBarTree.js.map