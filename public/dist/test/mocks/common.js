import * as tslib_1 from "tslib";
export var backendSrv = {
    get: jest.fn(),
    getDashboard: jest.fn(),
    getDashboardByUid: jest.fn(),
    getFolderByUid: jest.fn(),
    post: jest.fn(),
};
export function createNavTree() {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    var e_1, _a;
    var root = [];
    var node = root;
    try {
        for (var args_1 = tslib_1.__values(args), args_1_1 = args_1.next(); !args_1_1.done; args_1_1 = args_1.next()) {
            var arg = args_1_1.value;
            var child = { id: arg, url: "/url/" + arg, text: arg + "-Text", children: [] };
            node.push(child);
            node = child.children;
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (args_1_1 && !args_1_1.done && (_a = args_1.return)) _a.call(args_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return root;
}
export function createNavModel(title) {
    var tabs = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        tabs[_i - 1] = arguments[_i];
    }
    var e_2, _a;
    var node = {
        id: title,
        text: title,
        icon: 'fa fa-fw fa-warning',
        subTitle: 'subTitle',
        url: title,
        children: [],
        breadcrumbs: [],
    };
    try {
        for (var tabs_1 = tslib_1.__values(tabs), tabs_1_1 = tabs_1.next(); !tabs_1_1.done; tabs_1_1 = tabs_1.next()) {
            var tab = tabs_1_1.value;
            node.children.push({
                id: tab,
                icon: 'icon',
                subTitle: 'subTitle',
                url: title,
                text: title,
                active: false,
            });
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (tabs_1_1 && !tabs_1_1.done && (_a = tabs_1.return)) _a.call(tabs_1);
        }
        finally { if (e_2) throw e_2.error; }
    }
    node.children[0].active = true;
    return {
        node: node,
        main: node,
    };
}
//# sourceMappingURL=common.js.map