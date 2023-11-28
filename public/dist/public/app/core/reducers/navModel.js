import { createAction } from '@reduxjs/toolkit';
import { cloneDeep } from 'lodash';
import config from 'app/core/config';
import { getNavSubTitle, getNavTitle } from '../utils/navBarItem-translations';
export const HOME_NAV_ID = 'home';
export function buildInitialState() {
    const navIndex = {};
    const rootNodes = cloneDeep(config.bootData.navTree);
    const homeNav = rootNodes.find((node) => node.id === HOME_NAV_ID);
    const otherRootNodes = rootNodes.filter((node) => node.id !== HOME_NAV_ID);
    if (homeNav) {
        buildNavIndex(navIndex, [homeNav]);
    }
    // set home as parent for the other rootNodes
    // need to use the translated home node from the navIndex
    buildNavIndex(navIndex, otherRootNodes, navIndex[HOME_NAV_ID]);
    return navIndex;
}
function buildNavIndex(navIndex, children, parentItem) {
    var _a, _b;
    const translatedChildren = [];
    for (const node of children) {
        const translatedNode = Object.assign(Object.assign({}, node), { text: (_a = getNavTitle(node.id)) !== null && _a !== void 0 ? _a : node.text, subTitle: (_b = getNavSubTitle(node.id)) !== null && _b !== void 0 ? _b : node.subTitle, emptyMessage: getNavTitle(node.emptyMessageId), parentItem: parentItem });
        if (translatedNode.id) {
            navIndex[translatedNode.id] = translatedNode;
        }
        if (translatedNode.children) {
            buildNavIndex(navIndex, translatedNode.children, translatedNode);
        }
        translatedChildren.push(translatedNode);
    }
    // need to update the parentItem children with the new translated children
    if (parentItem) {
        parentItem.children = translatedChildren;
    }
    navIndex['not-found'] = Object.assign({}, buildWarningNav('Page not found', '404 Error').node);
    navIndex['error'] = Object.assign({}, buildWarningNav('Page error', 'An unexpected error').node);
}
function buildWarningNav(text, subTitle) {
    const node = {
        text,
        subTitle,
        icon: 'exclamation-triangle',
    };
    return {
        node: node,
        main: node,
    };
}
export const initialState = {};
export const updateNavIndex = createAction('navIndex/updateNavIndex');
// Since the configuration subtitle includes the organization name, we include this action to update the org name if it changes.
export const updateConfigurationSubtitle = createAction('navIndex/updateConfigurationSubtitle');
export const getItemWithNewSubTitle = (item, subTitle) => {
    var _a, _b;
    return (Object.assign(Object.assign({}, item), { parentItem: Object.assign(Object.assign({}, item.parentItem), { text: (_b = (_a = item.parentItem) === null || _a === void 0 ? void 0 : _a.text) !== null && _b !== void 0 ? _b : '', subTitle }) }));
};
// Redux Toolkit uses ImmerJs as part of their solution to ensure that state objects are not mutated.
// ImmerJs has an autoFreeze option that freezes objects from change which means this reducer can't be migrated to createSlice
// because the state would become frozen and during run time we would get errors because Angular would try to mutate
// the frozen state.
// https://github.com/reduxjs/redux-toolkit/issues/242
export const navIndexReducer = (state = initialState, action) => {
    if (updateNavIndex.match(action)) {
        const newPages = {};
        const payload = action.payload;
        function addNewPages(node) {
            if (node.children) {
                for (const child of node.children) {
                    newPages[child.id] = Object.assign(Object.assign({}, child), { parentItem: node });
                }
            }
            if (node.parentItem) {
                addNewPages(node.parentItem);
            }
        }
        addNewPages(payload);
        return Object.assign(Object.assign({}, state), newPages);
    }
    else if (updateConfigurationSubtitle.match(action)) {
        const subTitle = `Organization: ${action.payload}`;
        return Object.assign(Object.assign({}, state), { cfg: Object.assign(Object.assign({}, state.cfg), { subTitle }), datasources: getItemWithNewSubTitle(state.datasources, subTitle), correlations: getItemWithNewSubTitle(state.correlations, subTitle), users: getItemWithNewSubTitle(state.users, subTitle), teams: getItemWithNewSubTitle(state.teams, subTitle), plugins: getItemWithNewSubTitle(state.plugins, subTitle), 'org-settings': getItemWithNewSubTitle(state['org-settings'], subTitle), apikeys: getItemWithNewSubTitle(state.apikeys, subTitle) });
    }
    return state;
};
//# sourceMappingURL=navModel.js.map