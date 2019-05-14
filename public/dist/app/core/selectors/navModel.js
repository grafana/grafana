import * as tslib_1 from "tslib";
function getNotFoundModel() {
    var node = {
        id: 'not-found',
        text: 'Page not found',
        icon: 'fa fa-fw fa-warning',
        subTitle: '404 Error',
        url: 'not-found',
    };
    return {
        node: node,
        main: node,
    };
}
export function getNavModel(navIndex, id, fallback) {
    if (navIndex[id]) {
        var node_1 = navIndex[id];
        var main = tslib_1.__assign({}, node_1.parentItem);
        main.children = main.children.map(function (item) {
            return tslib_1.__assign({}, item, { active: item.url === node_1.url });
        });
        return {
            node: node_1,
            main: main,
        };
    }
    if (fallback) {
        return fallback;
    }
    return getNotFoundModel();
}
export var getTitleFromNavModel = function (navModel) {
    return "" + navModel.main.text + (navModel.node.text ? ': ' + navModel.node.text : '');
};
//# sourceMappingURL=navModel.js.map