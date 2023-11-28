import coreModule from 'app/angular/core_module';
import config from 'app/core/config';
import { getNotFoundNav } from 'app/core/navigation/errorModels';
export class NavModelSrv {
    constructor() {
        this.navItems = config.bootData.navTree;
    }
    getCfgNode() {
        return this.navItems.find((navItem) => navItem.id === 'cfg');
    }
    getNav(...args) {
        var _a, _b, _c;
        let children = this.navItems;
        const nav = {
            breadcrumbs: [],
        };
        for (const id of args) {
            // if its a number then it's the index to use for main
            if (typeof id === 'number') {
                nav.main = nav.breadcrumbs[id];
                break;
            }
            const node = children.find((child) => child.id === id);
            if (node) {
                nav.breadcrumbs.push(node);
                nav.node = node;
                nav.main = node;
                children = (_a = node.children) !== null && _a !== void 0 ? _a : [];
            }
        }
        if ((_b = nav.main) === null || _b === void 0 ? void 0 : _b.children) {
            for (const item of nav.main.children) {
                item.active = item.url === ((_c = nav.node) === null || _c === void 0 ? void 0 : _c.url);
            }
        }
        return nav;
    }
    getNotFoundNav() {
        return getNotFoundNav(); // the exported function
    }
}
coreModule.service('navModelSrv', NavModelSrv);
//# sourceMappingURL=nav_model_srv.js.map