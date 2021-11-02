import { __assign } from "tslib";
var getNotFoundModel = function () {
    var node = {
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
export var getNavModel = function (navIndex, id, fallback, onlyChild) {
    if (onlyChild === void 0) { onlyChild = false; }
    if (navIndex[id]) {
        var node_1 = navIndex[id];
        var main = void 0;
        if (!onlyChild && node_1.parentItem) {
            main = __assign({}, node_1.parentItem);
            main.children =
                main.children &&
                    main.children.map(function (item) {
                        return __assign(__assign({}, item), { active: item.url === node_1.url });
                    });
        }
        else {
            main = node_1;
        }
        return {
            node: node_1,
            main: main,
        };
    }
    if (fallback) {
        return fallback;
    }
    return getNotFoundModel();
};
export var getTitleFromNavModel = function (navModel) {
    return "" + navModel.main.text + (navModel.node.text ? ': ' + navModel.node.text : '');
};
//# sourceMappingURL=navModel.js.map