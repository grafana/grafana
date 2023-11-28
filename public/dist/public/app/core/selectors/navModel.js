import { newBrowseDashboardsEnabled } from 'app/features/browse-dashboards/featureFlag';
import { FOLDER_ID } from 'app/features/folders/state/navModel';
import { HOME_NAV_ID } from '../reducers/navModel';
const getNotFoundModel = () => {
    const node = {
        id: 'not-found',
        text: 'Page not found',
        icon: 'exclamation-triangle',
        subTitle: '404 Error',
        url: 'not-found',
    };
    return {
        node: node,
        main: node,
    };
};
export const getNavModel = (navIndex, id, fallback, onlyChild = false) => {
    if (navIndex[id]) {
        const node = navIndex[id];
        const main = onlyChild ? node : getRootSectionForNode(node);
        const mainWithActive = enrichNodeWithActiveState(main, id);
        return {
            node: node,
            main: mainWithActive,
        };
    }
    if (fallback) {
        return fallback;
    }
    return getNotFoundModel();
};
export function getRootSectionForNode(node) {
    // Don't recurse fully up the folder tree when nested folders is enabled
    if (newBrowseDashboardsEnabled() && node.id === FOLDER_ID) {
        return node;
    }
    else {
        return node.parentItem && node.parentItem.id !== HOME_NAV_ID ? getRootSectionForNode(node.parentItem) : node;
    }
}
function enrichNodeWithActiveState(node, activeId) {
    if (node.id === activeId) {
        return Object.assign(Object.assign({}, node), { active: true });
    }
    if (node.children && node.children.length > 0) {
        return Object.assign(Object.assign({}, node), { children: node.children.map((child) => enrichNodeWithActiveState(child, activeId)) });
    }
    return node;
}
export const getTitleFromNavModel = (navModel) => {
    return `${navModel.main.text}${navModel.node.text ? ': ' + navModel.node.text : ''}`;
};
//# sourceMappingURL=navModel.js.map