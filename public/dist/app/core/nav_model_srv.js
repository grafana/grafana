import * as tslib_1 from "tslib";
import coreModule from 'app/core/core_module';
import config from 'app/core/config';
import _ from 'lodash';
var NavModel = /** @class */ (function () {
    function NavModel() {
        this.breadcrumbs = [];
    }
    return NavModel;
}());
export { NavModel };
var NavModelSrv = /** @class */ (function () {
    /** @ngInject */
    function NavModelSrv() {
        this.navItems = config.bootData.navTree;
    }
    NavModelSrv.prototype.getCfgNode = function () {
        return _.find(this.navItems, { id: 'cfg' });
    };
    NavModelSrv.prototype.getNav = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        var e_1, _a, e_2, _b;
        var children = this.navItems;
        var nav = new NavModel();
        try {
            for (var args_1 = tslib_1.__values(args), args_1_1 = args_1.next(); !args_1_1.done; args_1_1 = args_1.next()) {
                var id = args_1_1.value;
                // if its a number then it's the index to use for main
                if (_.isNumber(id)) {
                    nav.main = nav.breadcrumbs[id];
                    break;
                }
                var node = _.find(children, { id: id });
                nav.breadcrumbs.push(node);
                nav.node = node;
                nav.main = node;
                children = node.children;
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (args_1_1 && !args_1_1.done && (_a = args_1.return)) _a.call(args_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        if (nav.main.children) {
            try {
                for (var _c = tslib_1.__values(nav.main.children), _d = _c.next(); !_d.done; _d = _c.next()) {
                    var item = _d.value;
                    item.active = false;
                    if (item.url === nav.node.url) {
                        item.active = true;
                    }
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (_d && !_d.done && (_b = _c.return)) _b.call(_c);
                }
                finally { if (e_2) throw e_2.error; }
            }
        }
        return nav;
    };
    NavModelSrv.prototype.getNotFoundNav = function () {
        var node = {
            text: 'Page not found',
            icon: 'fa fa-fw fa-warning',
            subTitle: '404 Error',
        };
        return {
            breadcrumbs: [node],
            node: node,
            main: node,
        };
    };
    return NavModelSrv;
}());
export { NavModelSrv };
coreModule.service('navModelSrv', NavModelSrv);
//# sourceMappingURL=nav_model_srv.js.map